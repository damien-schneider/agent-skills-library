use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

const BINARY: &str = "claude";
const EXTRA_PATHS: &str = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatus {
    pub available: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

fn install_prefixes() -> Vec<PathBuf> {
    let mut prefixes = vec![
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
    ];
    if let Some(home) = dirs::home_dir() {
        prefixes.insert(0, home.join(".bun/bin"));
        prefixes.insert(0, home.join(".claude/local"));
        prefixes.insert(0, home.join(".local/bin"));
    }
    prefixes
}

/// A bundled app inherits a bare PATH, so the login shell is the only place the
/// CLI is guaranteed to be resolvable once the usual prefixes miss.
fn from_login_shell() -> Option<PathBuf> {
    let shell = std::env::var("SHELL").ok()?;
    let output = Command::new(shell)
        .args(["-lic", &format!("command -v {BINARY}")])
        .output()
        .ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let path = PathBuf::from(
        stdout
            .lines()
            .rev()
            .find(|line| !line.trim().is_empty())?
            .trim(),
    );
    path.is_file().then_some(path)
}

pub fn resolve() -> Option<PathBuf> {
    install_prefixes()
        .into_iter()
        .map(|prefix| prefix.join(BINARY))
        .find(|candidate| candidate.is_file())
        .or_else(from_login_shell)
}

/// The child spawns node and its own helpers, so it needs a usable PATH of its
/// own — not the stripped one a bundled app is launched with.
pub fn child_path(binary: &Path) -> String {
    let inherited = std::env::var("PATH").unwrap_or_default();
    let own = binary
        .parent()
        .map(|dir| dir.display().to_string())
        .unwrap_or_default();
    format!("{own}:{EXTRA_PATHS}:{inherited}")
}

pub fn status() -> AgentStatus {
    let Some(path) = resolve() else {
        return AgentStatus {
            available: false,
            path: None,
            version: None,
        };
    };
    let version = Command::new(&path)
        .arg("--version")
        .env("PATH", child_path(&path))
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string());

    AgentStatus {
        available: version.is_some(),
        path: Some(path.display().to_string()),
        version,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn child_path_leads_with_the_binary_own_directory() {
        let path = child_path(Path::new("/Users/someone/.local/bin/claude"));

        assert!(path.starts_with("/Users/someone/.local/bin:"));
        assert!(path.contains("/opt/homebrew/bin"));
    }
}
