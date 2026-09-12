use std::path::PathBuf;
use crate::errors::MediaError;
use tauri::Manager;

pub fn resolve_binary(app: &tauri::AppHandle, binary_name: &str) -> Result<PathBuf, MediaError> {
    let ext = if cfg!(windows) { ".exe" } else { "" };
    let plain_filename = format!("{}{}", binary_name, ext);
    let target_triple = env!("TARGET_TRIPLE");
    let sidecar_filename = format!("{}-{}{}", binary_name, target_triple, ext);

    // 1. Check current executable directory (on macOS, Tauri packages externalBin into Contents/MacOS/ directly)
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            let path_plain = exe_dir.join(&plain_filename);
            if path_plain.exists() {
                return Ok(path_plain);
            }
            let path_sidecar = exe_dir.join(&sidecar_filename);
            if path_sidecar.exists() {
                return Ok(path_sidecar);
            }
            // In dev mode: exe is in target/debug or target/release
            let dev_path = exe_dir
                .parent()
                .and_then(|p| p.parent())
                .map(|p| p.join("binaries").join(&sidecar_filename));
            if let Some(dp) = dev_path {
                if dp.exists() {
                    return Ok(dp);
                }
            }
            let dev_plain = exe_dir
                .parent()
                .and_then(|p| p.parent())
                .map(|p| p.join("binaries").join(&plain_filename));
            if let Some(dp) = dev_plain {
                if dp.exists() {
                    return Ok(dp);
                }
            }
        }
    }

    // 2. Check tauri resource dir
    if let Ok(resource_dir) = app.path().resource_dir() {
        let path1 = resource_dir.join("binaries").join(&sidecar_filename);
        if path1.exists() {
            return Ok(path1);
        }
        let path2 = resource_dir.join("binaries").join(&plain_filename);
        if path2.exists() {
            return Ok(path2);
        }
        let path3 = resource_dir.join(&plain_filename);
        if path3.exists() {
            return Ok(path3);
        }
    }

    // 3. Check relative working directory
    let candidates = [
        PathBuf::from("src-tauri").join("binaries").join(&sidecar_filename),
        PathBuf::from("src-tauri").join("binaries").join(&plain_filename),
        PathBuf::from("binaries").join(&sidecar_filename),
        PathBuf::from("binaries").join(&plain_filename),
    ];
    for candidate in candidates {
        if candidate.exists() {
            return Ok(std::fs::canonicalize(&candidate).unwrap_or(candidate));
        }
    }

    // 4. Fallback dev paths
    #[cfg(windows)]
    {
        let choco_path = PathBuf::from("C:\\ProgramData\\chocolatey\\lib\\ffmpeg\\tools\\ffmpeg\\bin")
            .join(&plain_filename);
        if choco_path.exists() {
            return Ok(choco_path);
        }
    }

    #[cfg(not(windows))]
    {
        for prefix in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"] {
            let p = PathBuf::from(prefix).join(&plain_filename);
            if p.exists() {
                return Ok(p);
            }
        }
    }

    Err(MediaError::BinaryNotFound(binary_name.to_string()))
}
