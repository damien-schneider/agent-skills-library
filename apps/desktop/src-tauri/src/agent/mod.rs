mod cli;
mod stream;

pub use cli::{status, AgentStatus};
pub use stream::{parse_line, StreamEvent};

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStderr, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;

use tempfile::TempDir;

use crate::error::{AppError, AppResult};

const SYSTEM_PROMPT: &str = "You are editing a single Markdown file in an isolated scratch \
directory. Apply the request by editing that file in place with the Edit tool. Never create, \
rename or delete any other file. Answer in one or two sentences — the user reads the diff, not \
your prose.";

const DISALLOWED_TOOLS: &str = "Bash,WebFetch,WebSearch,Task,Skill,NotebookEdit";

const FALLBACK_FILE_NAME: &str = "document.md";

struct Session {
    file_id: i64,
    id: String,
    dir: TempDir,
    file_name: String,
    started: bool,
}

impl Session {
    fn new(file_id: i64, file_name: String) -> AppResult<Self> {
        Ok(Self {
            file_id,
            id: uuid::Uuid::new_v4().to_string(),
            dir: TempDir::new()?,
            file_name,
            started: false,
        })
    }

    fn document(&self) -> PathBuf {
        self.dir.path().join(&self.file_name)
    }
}

#[derive(Debug)]
pub struct RunHandle {
    pub run_id: u64,
    pub stdout: ChildStdout,
    pub stderr: ChildStderr,
}

pub struct Outcome {
    pub proposal: Option<String>,
    pub cancelled: bool,
}

/// One conversation at a time, scoped to one file. Switching file starts a new
/// session: a resumed transcript that points at a replaced scratch file would
/// have the agent reason about a document nobody is looking at.
#[derive(Default)]
pub struct AgentRuntime {
    session: Mutex<Option<Session>>,
    child: Mutex<Option<Child>>,
    cancelled: AtomicBool,
    running: AtomicBool,
    runs: AtomicU64,
}

fn sanitize(file_name: &str) -> String {
    Path::new(file_name)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(FALLBACK_FILE_NAME)
        .to_string()
}

impl AgentRuntime {
    pub fn start(
        &self,
        file_id: i64,
        file_name: &str,
        content: &str,
        prompt: &str,
    ) -> AppResult<RunHandle> {
        if self.running.swap(true, Ordering::SeqCst) {
            return Err(AppError::AgentBusy);
        }
        self.cancelled.store(false, Ordering::SeqCst);

        let started = cli::resolve()
            .ok_or(AppError::AgentMissing)
            .and_then(|binary| self.spawn(&binary, file_id, file_name, content, prompt));

        if started.is_err() {
            self.running.store(false, Ordering::SeqCst);
        }
        started
    }

    fn spawn(
        &self,
        binary: &Path,
        file_id: i64,
        file_name: &str,
        content: &str,
        prompt: &str,
    ) -> AppResult<RunHandle> {
        let mut slot = self
            .session
            .lock()
            .map_err(|_| AppError::internal("agent session mutex poisoned"))?;

        let session = match slot.take() {
            Some(session) if session.file_id == file_id => session,
            _ => Session::new(file_id, sanitize(file_name))?,
        };
        fs::write(session.document(), content)?;

        let mut child = command(binary, &session, prompt).spawn()?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| AppError::internal("agent stdout was not captured"))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| AppError::internal("agent stderr was not captured"))?;

        *self
            .child
            .lock()
            .map_err(|_| AppError::internal("agent child mutex poisoned"))? = Some(child);
        *slot = Some(session);

        Ok(RunHandle {
            run_id: self.runs.fetch_add(1, Ordering::Relaxed),
            stdout,
            stderr,
        })
    }

    /// Reads back the scratch document even when the run failed midway: a
    /// partial edit is still a diff the user can accept or throw away.
    pub fn finish(&self, failed: bool) -> Outcome {
        let cancelled = self.cancelled.load(Ordering::SeqCst);
        let document = self.session.lock().ok().and_then(|mut slot| {
            let session = slot.as_mut()?;
            session.started |= !(failed || cancelled);
            Some(session.document())
        });

        if let Ok(mut slot) = self.child.lock() {
            if let Some(mut child) = slot.take() {
                let _ = child.wait();
            }
        }
        self.running.store(false, Ordering::SeqCst);

        Outcome {
            proposal: document.and_then(|path| fs::read_to_string(path).ok()),
            cancelled,
        }
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
        if let Ok(mut slot) = self.child.lock() {
            if let Some(child) = slot.as_mut() {
                let _ = child.kill();
            }
        }
    }
}

fn command(binary: &Path, session: &Session, prompt: &str) -> Command {
    let mut command = Command::new(binary);
    command
        .current_dir(session.dir.path())
        .env("PATH", cli::child_path(binary))
        .arg("-p")
        .arg(prompt)
        .args(["--output-format", "stream-json", "--verbose"])
        .arg("--include-partial-messages")
        .args(["--setting-sources", ""])
        .arg("--strict-mcp-config")
        .args(["--disallowed-tools", DISALLOWED_TOOLS])
        .args(["--permission-mode", "acceptEdits"])
        .arg("--append-system-prompt")
        .arg(SYSTEM_PROMPT)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if session.started {
        command.args(["--resume", &session.id]);
    } else {
        command.args(["--session-id", &session.id]);
    }
    command
}

#[cfg(test)]
mod tests {
    use std::io::{BufRead as _, BufReader};

    use super::*;

    fn args_of(command: &Command) -> Vec<String> {
        command
            .get_args()
            .map(|arg| arg.to_string_lossy().to_string())
            .collect()
    }

    #[test]
    fn a_fresh_session_pins_its_id_and_a_started_one_resumes_it() {
        let mut session = Session::new(1, "CLAUDE.md".into()).unwrap();

        let fresh = args_of(&command(Path::new("claude"), &session, "hi"));
        session.started = true;
        let resumed = args_of(&command(Path::new("claude"), &session, "hi"));

        assert!(fresh.contains(&"--session-id".to_string()));
        assert!(resumed.contains(&"--resume".to_string()));
        assert!(!resumed.contains(&"--session-id".to_string()));
    }

    #[test]
    fn the_scratch_document_keeps_only_the_file_name() {
        let session = Session::new(1, sanitize("/Users/someone/.claude/CLAUDE.md")).unwrap();

        assert_eq!(session.document().file_name().unwrap(), "CLAUDE.md");
        assert!(session.document().starts_with(session.dir.path()));
    }

    #[test]
    fn a_second_run_is_refused_while_one_is_in_flight() {
        let runtime = AgentRuntime::default();
        runtime.running.store(true, Ordering::SeqCst);

        let error = runtime.start(1, "CLAUDE.md", "body", "prompt").unwrap_err();

        assert_eq!(error.code(), "agent_busy");
    }

    #[test]
    #[ignore = "spawns the real Claude Code CLI"]
    fn edits_the_scratch_copy_and_hands_the_result_back() {
        let runtime = AgentRuntime::default();

        let handle = runtime
            .start(
                1,
                "note.md",
                "# Titre\n\nBonjour.\n",
                "Replace Bonjour with Salut",
            )
            .unwrap();
        let mut streamed = String::new();
        let mut finished = false;
        for event in BufReader::new(handle.stdout)
            .lines()
            .map_while(Result::ok)
            .filter_map(|line| parse_line(&line))
        {
            match event {
                StreamEvent::Text(chunk) => streamed.push_str(&chunk),
                StreamEvent::Finished(failure) => finished = failure.is_none(),
                _ => (),
            }
        }

        assert!(finished);
        assert!(!streamed.is_empty(), "no token ever streamed");
        assert!(runtime.finish(false).proposal.unwrap().contains("Salut"));
    }
}
