use std::path::PathBuf;

use tauri::State;

use crate::db::now_ms;
use crate::db::prompts_repo::{self, PromptHistoryEntry};
use crate::error::{AppError, AppResult};
use crate::paths::canonicalize;
use crate::state::AppState;

fn validate_content(content: &str) -> AppResult<()> {
    if content.trim().is_empty() {
        return Err(AppError::InvalidInput(
            "prompt content cannot be empty".to_string(),
        ));
    }
    Ok(())
}

fn normalize_destination_path(path: &str) -> AppResult<String> {
    let resolved = canonicalize(&PathBuf::from(path))?;
    if !resolved.is_dir() {
        return Err(AppError::InvalidPath(format!(
            "{} is not a directory",
            resolved.display()
        )));
    }
    Ok(resolved.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn list_prompt_history(state: State<'_, AppState>) -> AppResult<Vec<PromptHistoryEntry>> {
    state.db.with_conn(prompts_repo::list)
}

#[tauri::command]
pub fn create_prompt(
    state: State<'_, AppState>,
    content: String,
    destination_path: Option<String>,
) -> AppResult<PromptHistoryEntry> {
    validate_content(&content)?;
    let destination_path = destination_path
        .map(|path| normalize_destination_path(&path))
        .transpose()?;

    state.db.with_conn(|conn| {
        let id = prompts_repo::insert(conn, &content, destination_path.as_deref(), now_ms())?;
        prompts_repo::get(conn, id)?
            .ok_or_else(|| AppError::internal("prompt vanished right after insert"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn rejects_an_empty_prompt() {
        let error = validate_content(" \n ").unwrap_err();

        assert_eq!(error.code(), "invalid_input");
    }

    #[test]
    fn stores_a_canonical_existing_destination() {
        let directory = tempdir().unwrap();
        let expected = directory.path().canonicalize().unwrap();

        let normalized = normalize_destination_path(&directory.path().to_string_lossy()).unwrap();

        assert_eq!(PathBuf::from(normalized), expected);
    }
}
