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

/// Deterministic FNV-1a hash across process executions and platforms
pub fn compute_stable_hash(path: &Path) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for &b in path.to_string_lossy().as_bytes() {
        hash ^= b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    if let Ok(meta) = std::fs::metadata(path) {
        let len = meta.len();
        for &b in &len.to_le_bytes() {
            hash ^= b as u64;
            hash = hash.wrapping_mul(0x100000001b3);
        }
        if let Ok(mtime) = meta.modified() {
            if let Ok(dur) = mtime.duration_since(std::time::UNIX_EPOCH) {
                let secs = dur.as_secs();
                for &b in &secs.to_le_bytes() {
                    hash ^= b as u64;
                    hash = hash.wrapping_mul(0x100000001b3);
                }
            }
        }
    }
    hash
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
    let hash_key = compute_stable_hash(source_path);
    let proxy_filename = format!("proxy_{:016x}.mp4", hash_key);
    let proxy_path = proxy_dir.join(&proxy_filename);

    if proxy_path.exists() {
        if let Ok(meta) = std::fs::metadata(&proxy_path) {
            if meta.len() > 1024 {
                return Ok(proxy_path);
            }
        }
        let _ = std::fs::remove_file(&proxy_path);
    }

    // Unique temporary part file prevents concurrent proxy jobs from corrupting each other
    let pid = std::process::id();
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let part_path = proxy_dir.join(format!("proxy_{:016x}_{}_{}.part.mp4", hash_key, pid, nonce));
    let _ = std::fs::remove_file(&part_path);

    let mut cmd = Command::new(ffmpeg_bin);
    cmd.args(&[
        "-y",
        "-v",
        "error",
        "-threads",
        "0",
        "-i",
    ])
    .arg(source_path)
    .args(&[
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-sn",
        "-dn",
        "-write_tmcd",
        "0",
        "-vf",
        "scale=-2:360",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-profile:v",
        "main",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "28",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
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

    let _ = std::fs::remove_file(&proxy_path);
    std::fs::rename(&part_path, &proxy_path)?;

    Ok(proxy_path)
}

