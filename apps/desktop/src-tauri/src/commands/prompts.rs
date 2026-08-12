use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use tauri::State;

use crate::db::now_ms;
use crate::db::prompts_repo::{self, PromptHistoryEntry};
use crate::error::{AppError, AppResult};
use crate::paths::canonicalize;
use crate::state::AppState;

const MAX_ATTACHMENTS: usize = 8;
const MAX_IMAGE_PIXELS: usize = 20_000_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingPromptImage {
    pub rgba: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

fn validate_images(images: &[PendingPromptImage]) -> AppResult<()> {
    if images.len() > MAX_ATTACHMENTS {
        return Err(AppError::InvalidInput(format!(
            "a prompt can have at most {MAX_ATTACHMENTS} images"
        )));
    }
    for image in images {
        let pixels = (image.width as usize)
            .checked_mul(image.height as usize)
            .ok_or_else(|| AppError::InvalidInput("image dimensions are too large".to_string()))?;
        if pixels == 0 || pixels > MAX_IMAGE_PIXELS || image.rgba.len() != pixels * 4 {
            return Err(AppError::InvalidInput(
                "invalid RGBA image payload".to_string(),
            ));
        }
    }
    Ok(())
}

fn write_png(path: &Path, image: &PendingPromptImage) -> AppResult<()> {
    let file = fs::File::create(path)?;
    let mut encoder = png::Encoder::new(file, image.width, image.height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder
        .write_header()
        .map_err(|error| AppError::internal(format!("could not encode image: {error}")))?;
    writer
        .write_image_data(&image.rgba)
        .map_err(|error| AppError::internal(format!("could not encode image: {error}")))?;
    Ok(())
}

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
    images: Vec<PendingPromptImage>,
) -> AppResult<PromptHistoryEntry> {
    create_prompt_in(state.inner(), content, destination_path, images)
}
pub fn create_prompt_in(
    state: &AppState,
    content: String,
    destination_path: Option<String>,
    images: Vec<PendingPromptImage>,
) -> AppResult<PromptHistoryEntry> {
    validate_content(&content)?;
    validate_images(&images)?;
    let destination_path = destination_path
        .map(|path| normalize_destination_path(&path))
        .transpose()?;

    let created_at = now_ms();
    if images.is_empty() {
        let prompt_id = state.db.with_conn(|conn| {
            prompts_repo::insert(conn, &content, destination_path.as_deref(), created_at)
        })?;
        return state
            .db
            .with_conn(|conn| prompts_repo::get(conn, prompt_id))?
            .ok_or_else(|| AppError::internal("prompt vanished right after insert"));
    }

    fs::create_dir_all(&state.prompt_attachments_dir)?;
    let staging_dir = tempfile::Builder::new()
        .prefix("pending-")
        .tempdir_in(&state.prompt_attachments_dir)?;
    for (index, image) in images.iter().enumerate() {
        write_png(
            &staging_dir.path().join(format!("image-{}.png", index + 1)),
            image,
        )?;
    }

    let prompt_id = state.db.with_conn(|conn| {
        prompts_repo::insert(conn, &content, destination_path.as_deref(), created_at)
    })?;
    let prompt_dir = state.prompt_attachments_dir.join(prompt_id.to_string());
    let staged_path = staging_dir.keep();
    if let Err(error) = fs::rename(&staged_path, &prompt_dir) {
        let _ = fs::remove_dir_all(&staged_path);
        state
            .db
            .with_conn(|conn| prompts_repo::delete(conn, prompt_id))?;
        return Err(error.into());
    }

    let prompt = state.db.with_tx(|tx| {
        for (index, image) in images.iter().enumerate() {
            let path = prompt_dir.join(format!("image-{}.png", index + 1));
            prompts_repo::insert_attachment(
                tx,
                prompt_id,
                &path.to_string_lossy(),
                "image/png",
                image.width as i64,
                image.height as i64,
                created_at,
            )?;
        }
        prompts_repo::get(tx, prompt_id)?
            .ok_or_else(|| AppError::internal("prompt vanished right after insert"))
    });
    if prompt.is_err() {
        let _ = fs::remove_dir_all(&prompt_dir);
        let _ = state
            .db
            .with_conn(|conn| prompts_repo::delete(conn, prompt_id));
    }
    prompt
}

#[tauri::command]
pub fn read_prompt_attachment(
    state: State<'_, AppState>,
    attachment_id: i64,
) -> AppResult<Vec<u8>> {
    let attachment = state
        .db
        .with_conn(|conn| prompts_repo::get_attachment(conn, attachment_id))?
        .ok_or_else(|| AppError::NotFound(format!("attachment {attachment_id} does not exist")))?;
    fs::read(attachment.path).map_err(AppError::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;
    use std::io::BufReader;
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

    #[test]
    fn writes_a_valid_png_attachment() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("attachment.png");
        let image = PendingPromptImage {
            rgba: vec![255, 0, 0, 255],
            width: 1,
            height: 1,
        };

        write_png(&path, &image).unwrap();

        let decoder = png::Decoder::new(BufReader::new(fs::File::open(path).unwrap()));
        let reader = decoder.read_info().unwrap();
        assert_eq!(reader.info().width, 1);
        assert_eq!(reader.info().height, 1);
    }

    #[test]
    fn rejects_an_invalid_image_payload() {
        let image = PendingPromptImage {
            rgba: vec![255, 0, 0],
            width: 1,
            height: 1,
        };

        assert_eq!(
            validate_images(&[image]).unwrap_err().code(),
            "invalid_input"
        );
    }

    #[test]
    fn stores_prompt_images_in_their_final_directory() {
        let app_data = tempdir().unwrap();
        let attachment_root = app_data.path().join("prompt-attachments");
        let state = AppState::new(Db::open_in_memory().unwrap(), attachment_root);
        let image = PendingPromptImage {
            rgba: vec![255, 0, 0, 255],
            width: 1,
            height: 1,
        };

        let prompt =
            create_prompt_in(&state, "Inspect this screenshot".into(), None, vec![image]).unwrap();

        assert_eq!(prompt.attachments.len(), 1);
        let attachment = &prompt.attachments[0];
        assert_eq!(
            PathBuf::from(&attachment.path),
            state
                .prompt_attachments_dir
                .join(prompt.id.to_string())
                .join("image-1.png")
        );
        assert!(Path::new(&attachment.path).is_file());
        assert_eq!(
            fs::read_dir(&state.prompt_attachments_dir).unwrap().count(),
            1
        );
    }

    #[test]
    fn removes_the_prompt_when_the_final_directory_is_unavailable() {
        let app_data = tempdir().unwrap();
        let attachment_root = app_data.path().join("prompt-attachments");
        fs::create_dir_all(&attachment_root).unwrap();
        fs::write(attachment_root.join("1"), b"blocks directory creation").unwrap();
        let state = AppState::new(Db::open_in_memory().unwrap(), attachment_root);
        let image = PendingPromptImage {
            rgba: vec![255, 0, 0, 255],
            width: 1,
            height: 1,
        };

        let result = create_prompt_in(&state, "This should roll back".into(), None, vec![image]);

        assert!(result.is_err());
        assert!(state.db.with_conn(prompts_repo::list).unwrap().is_empty());
        assert_eq!(
            fs::read_dir(&state.prompt_attachments_dir).unwrap().count(),
            1
        );
    }
}
