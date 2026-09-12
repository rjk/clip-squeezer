use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorDetails {
    pub title: String,
    pub message: String,
    pub technical_details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MediaError {
    FileNotFound(String),
    InvalidMedia { message: String, details: Option<String> },
    NoVideoStream,
    NoAudioStream,
    InvalidTrimBounds(String),
    InsufficientSpace { required_mb: u64, available_mb: u64 },
    ProcessFailed { exit_code: Option<i32>, stderr: String },
    Cancelled,
    OutputValidationFailed(String),
    BinaryNotFound(String),
    IoError(String),
}

impl MediaError {
    pub fn to_user_friendly(&self) -> ErrorDetails {
        match self {
            MediaError::FileNotFound(path) => ErrorDetails {
                title: "File not found".to_string(),
                message: "The requested file could not be found. It may have been moved or deleted.".to_string(),
                technical_details: Some(format!("Path: {}", path)),
            },
            MediaError::InvalidMedia { message, details } => ErrorDetails {
                title: "Unreadable file".to_string(),
                message: "The video or audio could not be read. The file may be damaged or in an unsupported format.".to_string(),
                technical_details: details.clone().or_else(|| Some(message.clone())),
            },
            MediaError::NoVideoStream => ErrorDetails {
                title: "No video found".to_string(),
                message: "This file doesn't appear to contain a video track.".to_string(),
                technical_details: None,
            },
            MediaError::NoAudioStream => ErrorDetails {
                title: "No audio track".to_string(),
                message: "This video doesn't contain an audio track.".to_string(),
                technical_details: None,
            },
            MediaError::InvalidTrimBounds(reason) => ErrorDetails {
                title: "Invalid trim range".to_string(),
                message: "Please check the start and end times for trimming.".to_string(),
                technical_details: Some(reason.clone()),
            },
            MediaError::InsufficientSpace { required_mb, available_mb } => ErrorDetails {
                title: "Not enough disk space".to_string(),
                message: format!("There isn't enough free space to save the file. (Required: ~{} MB, Available: {} MB)", required_mb, available_mb),
                technical_details: None,
            },
            MediaError::ProcessFailed { exit_code, stderr } => ErrorDetails {
                title: "Operation failed".to_string(),
                message: "The media conversion could not be completed.".to_string(),
                technical_details: Some(format!("Exit code: {:?}\nStderr:\n{}", exit_code, stderr)),
            },
            MediaError::Cancelled => ErrorDetails {
                title: "Cancelled".to_string(),
                message: "The operation was cancelled.".to_string(),
                technical_details: None,
            },
            MediaError::OutputValidationFailed(reason) => ErrorDetails {
                title: "Verification failed".to_string(),
                message: "The operation finished, but the resulting file could not be verified.".to_string(),
                technical_details: Some(reason.clone()),
            },
            MediaError::BinaryNotFound(bin) => ErrorDetails {
                title: "Engine missing".to_string(),
                message: format!("The required media component '{}' is missing.", bin),
                technical_details: Some(format!("Binary: {}", bin)),
            },
            MediaError::IoError(err) => ErrorDetails {
                title: "File error".to_string(),
                message: "An unexpected error occurred accessing the file system.".to_string(),
                technical_details: Some(err.clone()),
            },
        }
    }
}

impl fmt::Display for MediaError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let details = self.to_user_friendly();
        write!(f, "{}: {}", details.title, details.message)
    }
}

impl std::error::Error for MediaError {}

impl From<std::io::Error> for MediaError {
    fn from(err: std::io::Error) -> Self {
        MediaError::IoError(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_not_found_mapping() {
        let err = MediaError::FileNotFound("C:/missing.mp4".to_string());
        let friendly = err.to_user_friendly();
        assert_eq!(friendly.title, "File not found");
        assert!(friendly.message.contains("could not be found"));
        assert_eq!(friendly.technical_details, Some("Path: C:/missing.mp4".to_string()));
    }

    #[test]
    fn test_invalid_media_mapping() {
        let err = MediaError::InvalidMedia {
            message: "corrupted header".to_string(),
            details: Some("moov atom not found".to_string()),
        };
        let friendly = err.to_user_friendly();
        assert_eq!(friendly.title, "Unreadable file");
        assert!(friendly.message.contains("could not be read"));
        assert_eq!(friendly.technical_details, Some("moov atom not found".to_string()));
    }

    #[test]
    fn test_process_failed_mapping() {
        let err = MediaError::ProcessFailed {
            exit_code: Some(1),
            stderr: "Invalid data found when processing input".to_string(),
        };
        let friendly = err.to_user_friendly();
        assert_eq!(friendly.title, "Operation failed");
        assert!(friendly.technical_details.unwrap().contains("Invalid data found"));
    }

    #[test]
    fn test_trim_bounds_mapping() {
        let err = MediaError::InvalidTrimBounds("start >= end".to_string());
        let friendly = err.to_user_friendly();
        assert_eq!(friendly.title, "Invalid trim range");
        assert_eq!(friendly.technical_details, Some("start >= end".to_string()));
    }

    #[test]
    fn test_binary_not_found_mapping() {
        let err = MediaError::BinaryNotFound("ffmpeg".to_string());
        let friendly = err.to_user_friendly();
        assert_eq!(friendly.title, "Engine missing");
        assert!(friendly.message.contains("ffmpeg"));
    }

    #[test]
    fn test_display_trait() {
        let err = MediaError::NoAudioStream;
        let s = format!("{}", err);
        assert_eq!(s, "No audio track: This video doesn't contain an audio track.");
    }
}
