use serde::ser::{SerializeStruct as _, Serializer};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    NotFound(String),

    #[error("{0}")]
    InvalidPath(String),

    #[error("path is not inside an enabled root: {0}")]
    OutsideRoots(String),

    #[error("{0} changed on disk since it was read")]
    Conflict(String),

    #[error("a scan is already running")]
    ScanBusy,

    #[error("{0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Db(#[from] rusqlite::Error),

    #[error("{0}")]
    Internal(String),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFound(_) => "not_found",
            Self::InvalidPath(_) => "invalid_path",
            Self::OutsideRoots(_) => "outside_roots",
            Self::Conflict(_) => "conflict",
            Self::ScanBusy => "scan_busy",
            Self::Io(_) => "io",
            Self::Db(_) => "db",
            Self::Internal(_) => "internal",
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal(message.into())
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_to_code_and_message() {
        let json = serde_json::to_value(AppError::Conflict("CLAUDE.md".into())).unwrap();

        assert_eq!(json["code"], "conflict");
        assert_eq!(
            json["message"],
            "CLAUDE.md changed on disk since it was read"
        );
    }

    #[test]
    fn maps_io_errors_to_the_io_code() {
        let err: AppError = std::io::Error::new(std::io::ErrorKind::NotFound, "nope").into();

        assert_eq!(err.code(), "io");
    }
}
