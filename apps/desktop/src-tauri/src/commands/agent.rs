use std::io::{BufRead as _, BufReader, Read as _};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager as _, State};

use crate::agent::{self, AgentStatus, StreamEvent};
use crate::db::files_repo;
use crate::error::AppResult;
use crate::events::{self, AgentDelta, AgentDone, AgentError, AgentTool};
use crate::state::AppState;

const STDERR_TAIL: usize = 600;

enum RunEnd {
    Completed,
    Failed(String),
}

#[tauri::command]
pub fn agent_status() -> AgentStatus {
    agent::status()
}

#[tauri::command]
pub fn agent_cancel(state: State<'_, AppState>) {
    state.agent.cancel();
}

#[tauri::command]
pub fn agent_send(
    app: AppHandle,
    state: State<'_, AppState>,
    file_id: i64,
    content: String,
    prompt: String,
) -> AppResult<u64> {
    let row = state
        .db
        .with_conn(|conn| files_repo::require(conn, file_id))?;
    let handle = state
        .agent
        .start(file_id, &row.rel_path, &content, &prompt)?;
    let run_id = handle.run_id;

    std::thread::spawn(move || {
        stream_until_done(app, handle);
    });

    Ok(run_id)
}

fn stream_until_done(app: AppHandle, handle: agent::RunHandle) {
    let agent::RunHandle {
        run_id,
        stdout,
        mut stderr,
    } = handle;

    // Drained concurrently: a full stderr pipe would block the child forever.
    let noise = Arc::new(Mutex::new(String::new()));
    let collector = {
        let sink = Arc::clone(&noise);
        std::thread::spawn(move || {
            let mut buffer = String::new();
            let _ = stderr.read_to_string(&mut buffer);
            if let Ok(mut slot) = sink.lock() {
                *slot = buffer;
            }
        })
    };

    let mut end: Option<RunEnd> = None;
    let mut block = 0;
    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
        match agent::parse_line(&line) {
            Some(StreamEvent::TextStart) => block += 1,
            Some(StreamEvent::Text(text)) => {
                events::emit_agent_delta(
                    &app,
                    AgentDelta {
                        run_id,
                        block,
                        text,
                    },
                );
            }
            Some(StreamEvent::Tool(name)) => {
                events::emit_agent_tool(&app, AgentTool { run_id, name });
            }
            Some(StreamEvent::Finished(failure)) => {
                end = Some(match failure {
                    Some(message) => RunEnd::Failed(message),
                    None => RunEnd::Completed,
                });
            }
            None => (),
        }
    }
    let _ = collector.join();

    let end = end.unwrap_or_else(|| {
        let tail = noise.lock().map(|slot| slot.clone()).unwrap_or_default();
        RunEnd::Failed(crash_reason(&tail))
    });
    let outcome = app
        .state::<AppState>()
        .agent
        .finish(matches!(end, RunEnd::Failed(_)));

    match end {
        RunEnd::Failed(message) if !outcome.cancelled => {
            events::emit_agent_error(&app, AgentError { run_id, message });
        }
        _ => events::emit_agent_done(
            &app,
            AgentDone {
                run_id,
                proposal: outcome.proposal,
                cancelled: outcome.cancelled,
            },
        ),
    }
}

/// The CLI dies without a result line on a crash, and its last stderr words are
/// the only clue left about why.
fn crash_reason(stderr: &str) -> String {
    let tail = stderr.trim();
    if tail.is_empty() {
        return "the agent stopped unexpectedly".to_string();
    }
    tail.chars()
        .skip(tail.chars().count().saturating_sub(STDERR_TAIL))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_silent_crash_still_reports_something() {
        assert_eq!(crash_reason("  \n"), "the agent stopped unexpectedly");
    }

    #[test]
    fn only_the_tail_of_a_long_stderr_is_kept() {
        let noise = "x".repeat(STDERR_TAIL + 50);

        assert_eq!(crash_reason(&noise).len(), STDERR_TAIL);
    }
}
