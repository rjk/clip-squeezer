use std::path::Path;
use std::process::Command;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::errors::MediaError;
use crate::media::format::{format_bytes, format_duration, format_resolution};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VideoStreamInfo {
    pub codec: String,
    pub width: u32,
    pub height: u32,
    pub frame_rate: Option<f64>,
    pub pixel_format: Option<String>,
    pub rotation: i32,
    pub duration_seconds: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AudioStreamInfo {
    pub codec: String,
    pub channels: u32,
    pub sample_rate: u32,
    pub language: Option<String>,
    pub duration_seconds: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaInfo {
    pub path: String,
    pub filename: String,
    pub container: Option<String>,
    pub duration_seconds: f64,
    pub size_bytes: u64,
    pub video_streams: Vec<VideoStreamInfo>,
    pub audio_streams: Vec<AudioStreamInfo>,
    pub friendly_duration: String,
    pub friendly_resolution: String,
    pub friendly_size: String,
    pub has_video: bool,
    pub has_audio: bool,
}

pub fn parse_ffprobe_json(raw_json: &str, file_path: &Path) -> Result<MediaInfo, MediaError> {
    let parsed: Value = serde_json::from_str(raw_json).map_err(|e| MediaError::InvalidMedia {
        message: "Failed to parse media probe data.".to_string(),
        details: Some(e.to_string()),
    })?;

    let format = parsed.get("format");
    let container = format
        .and_then(|f| f.get("format_name"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let duration_seconds = format
        .and_then(|f| f.get("duration"))
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let size_bytes = format
        .and_then(|f| f.get("size"))
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<u64>().ok())
        .or_else(|| std::fs::metadata(file_path).ok().map(|m| m.len()))
        .unwrap_or(0);

    let streams = parsed
        .get("streams")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut video_streams = Vec::new();
    let mut audio_streams = Vec::new();

    for stream in streams {
        let codec_type = stream.get("codec_type").and_then(|v| v.as_str()).unwrap_or("");
        let codec_name = stream
            .get("codec_name")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let stream_duration = stream
            .get("duration")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<f64>().ok());

        if codec_type == "video" {
            let width = stream.get("width").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
            let height = stream.get("height").and_then(|v| v.as_u64()).unwrap_or(0) as u32;

            let frame_rate = stream
                .get("r_frame_rate")
                .and_then(|v| v.as_str())
                .and_then(|fps_str| {
                    if let Some((num, den)) = fps_str.split_once('/') {
                        let n = num.parse::<f64>().ok()?;
                        let d = den.parse::<f64>().ok()?;
                        if d > 0.0 {
                            Some(n / d)
                        } else {
                            None
                        }
                    } else {
                        fps_str.parse::<f64>().ok()
                    }
                });

            let pixel_format = stream
                .get("pix_fmt")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            // Rotation extraction
            let mut rotation = 0;
            if let Some(rotate_tag) = stream
                .get("tags")
                .and_then(|t| t.get("rotate"))
                .and_then(|r| r.as_str())
            {
                if let Ok(rot) = rotate_tag.parse::<i32>() {
                    rotation = rot;
                }
            }
            if rotation == 0 {
                if let Some(side_data_list) = stream.get("side_data_list").and_then(|v| v.as_array()) {
                    for side_data in side_data_list {
                        if let Some(rot) = side_data.get("rotation").and_then(|r| r.as_i64()) {
                            rotation = rot as i32;
                            break;
                        }
                    }
                }
            }

            video_streams.push(VideoStreamInfo {
                codec: codec_name,
                width,
                height,
                frame_rate,
                pixel_format,
                rotation,
                duration_seconds: stream_duration,
            });
        } else if codec_type == "audio" {
            let channels = stream.get("channels").and_then(|v| v.as_u64()).unwrap_or(2) as u32;
            let sample_rate = stream
                .get("sample_rate")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(44100);

            let language = stream
                .get("tags")
                .and_then(|t| t.get("language"))
                .and_then(|l| l.as_str())
                .map(|s| s.to_string());

            audio_streams.push(AudioStreamInfo {
                codec: codec_name,
                channels,
                sample_rate,
                language,
                duration_seconds: stream_duration,
            });
        }
    }

    let has_video = !video_streams.is_empty();
    let has_audio = !audio_streams.is_empty();

    let friendly_duration = format_duration(duration_seconds);
    let friendly_size = format_bytes(size_bytes);
    let friendly_resolution = if let Some(v) = video_streams.first() {
        format_resolution(v.width, v.height)
    } else {
        "Audio only".to_string()
    };

    let filename = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(MediaInfo {
        path: file_path.to_string_lossy().to_string(),
        filename,
        container,
        duration_seconds,
        size_bytes,
        video_streams,
        audio_streams,
        friendly_duration,
        friendly_resolution,
        friendly_size,
        has_video,
        has_audio,
    })
}

/// Execute ffprobe directly on the given path with argument vector (no shell string)
pub fn probe_media_file(ffprobe_bin: &Path, file_path: &Path) -> Result<MediaInfo, MediaError> {
    if !file_path.exists() {
        return Err(MediaError::FileNotFound(file_path.to_string_lossy().to_string()));
    }

    let output = Command::new(ffprobe_bin)
        .args(&[
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
        ])
        .arg(file_path)
        .output()
        .map_err(|e| MediaError::ProcessFailed {
            exit_code: None,
            stderr: format!("Failed to spawn ffprobe: {}", e),
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(MediaError::InvalidMedia {
            message: "FFprobe could not read the media file.".to_string(),
            details: Some(stderr),
        });
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    parse_ffprobe_json(&stdout_str, file_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_parse_ffprobe_json_valid_mp4() {
        let sample_json = r#"{
            "streams": [
                {
                    "index": 0,
                    "codec_name": "h264",
                    "codec_type": "video",
                    "width": 1920,
                    "height": 1080,
                    "r_frame_rate": "30/1",
                    "pix_fmt": "yuv420p",
                    "duration": "222.000000"
                },
                {
                    "index": 1,
                    "codec_name": "aac",
                    "codec_type": "audio",
                    "channels": 2,
                    "sample_rate": "48000",
                    "duration": "222.000000"
                }
            ],
            "format": {
                "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
                "duration": "222.000000",
                "size": "1932735283"
            }
        }"#;

        let path = PathBuf::from("C:\\videos\\holiday-video.mp4");
        let info = parse_ffprobe_json(sample_json, &path).expect("Should parse successfully");

        assert_eq!(info.filename, "holiday-video.mp4");
        assert_eq!(info.duration_seconds, 222.0);
        assert_eq!(info.friendly_duration, "3 min 42 sec");
        assert_eq!(info.friendly_resolution, "1080p");
        assert_eq!(info.friendly_size, "1.8 GB");
        assert!(info.has_video);
        assert!(info.has_audio);
        assert_eq!(info.video_streams.len(), 1);
        assert_eq!(info.video_streams[0].codec, "h264");
        assert_eq!(info.video_streams[0].frame_rate, Some(30.0));
        assert_eq!(info.audio_streams[0].codec, "aac");
    }

    #[test]
    fn test_parse_ffprobe_json_no_audio() {
        let sample_json = r#"{
            "streams": [
                {
                    "index": 0,
                    "codec_name": "h264",
                    "codec_type": "video",
                    "width": 3840,
                    "height": 2160,
                    "r_frame_rate": "60/1",
                    "pix_fmt": "yuv420p"
                }
            ],
            "format": {
                "format_name": "mp4",
                "duration": "45.000000",
                "size": "432000000"
            }
        }"#;

        let path = PathBuf::from("timelapse.mp4");
        let info = parse_ffprobe_json(sample_json, &path).expect("Should parse");
        assert_eq!(info.friendly_resolution, "4K");
        assert!(info.has_video);
        assert!(!info.has_audio);
        assert_eq!(info.audio_streams.len(), 0);
    }
}
