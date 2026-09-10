use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};
use crate::errors::MediaError;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn get_proxy_cache_dir(app: &AppHandle) -> Result<PathBuf, MediaError> {
    let base = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("simple_video_utility_cache"));
    let proxy_dir = base.join("proxies");
    std::fs::create_dir_all(&proxy_dir)?;
    Ok(proxy_dir)
}

pub fn generate_preview_proxy_file(
    app: &AppHandle,
    ffmpeg_bin: &Path,
    source_path: &Path,
) -> Result<PathBuf, MediaError> {
    if !source_path.exists() {
        return Err(MediaError::FileNotFound(source_path.to_string_lossy().to_string()));
    }

    let proxy_dir = get_proxy_cache_dir(app)?;

    // Hash source path and mod time for deterministic cache key
    let mut hasher = DefaultHasher::new();
    source_path.hash(&mut hasher);
    if let Ok(meta) = std::fs::metadata(source_path) {
        if let Ok(mtime) = meta.modified() {
            mtime.hash(&mut hasher);
        }
    }
    let hash_key = hasher.finish();
    let proxy_filename = format!("proxy_{:x}.mp4", hash_key);
    let proxy_path = proxy_dir.join(&proxy_filename);
    let part_path = proxy_dir.join(format!("proxy_{:x}.part.mp4", hash_key));

    if proxy_path.exists() {
        if let Ok(meta) = std::fs::metadata(&proxy_path) {
            if meta.len() > 1024 {
                return Ok(proxy_path);
            }
        }
        let _ = std::fs::remove_file(&proxy_path);
    }

    let _ = std::fs::remove_file(&part_path);

    let mut cmd = Command::new(ffmpeg_bin);
    cmd.args(&[
        "-y",
        "-v",
        "error",
        "-i",
    ])
    .arg(source_path)
    .args(&[
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-vf",
        "scale=-2:360",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "fastdecode",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "28",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-movflags",
        "+faststart",
    ])
    .arg(&part_path);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| MediaError::ProcessFailed {
        exit_code: None,
        stderr: format!("Failed to launch proxy generation: {}", e),
    })?;

    if !output.status.success() {
        let _ = std::fs::remove_file(&part_path);
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(MediaError::ProcessFailed {
            exit_code: output.status.code(),
            stderr,
        });
    }

    if !part_path.exists() {
        return Err(MediaError::OutputValidationFailed("Proxy file was not created".to_string()));
    }

    std::fs::rename(&part_path, &proxy_path)?;

    Ok(proxy_path)
}
