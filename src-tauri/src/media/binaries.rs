use std::path::PathBuf;
use crate::errors::MediaError;
use tauri::Manager;

const TARGET_TRIPLE: &str = "x86_64-pc-windows-msvc";

pub fn resolve_binary(app: &tauri::AppHandle, binary_name: &str) -> Result<PathBuf, MediaError> {
    let sidecar_filename = format!("{}-{}.exe", binary_name, TARGET_TRIPLE);
    let plain_filename = format!("{}.exe", binary_name);

    // 1. Check tauri resource dir
    if let Ok(resource_dir) = app.path().resource_dir() {
        let path1 = resource_dir.join("binaries").join(&sidecar_filename);
        if path1.exists() {
            return Ok(path1);
        }
        let path2 = resource_dir.join(&plain_filename);
        if path2.exists() {
            return Ok(path2);
        }
    }

    // 2. Check current executable parent directory
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            let path = exe_dir.join(&sidecar_filename);
            if path.exists() {
                return Ok(path);
            }
            let path_plain = exe_dir.join(&plain_filename);
            if path_plain.exists() {
                return Ok(path_plain);
            }
            // In dev mode: exe is in target/debug
            let dev_path = exe_dir
                .parent()
                .and_then(|p| p.parent())
                .map(|p| p.join("binaries").join(&sidecar_filename));
            if let Some(dp) = dev_path {
                if dp.exists() {
                    return Ok(dp);
                }
            }
        }
    }

    // 3. Check relative working directory
    let cwd_binaries = PathBuf::from("src-tauri").join("binaries").join(&sidecar_filename);
    if cwd_binaries.exists() {
        return Ok(std::fs::canonicalize(cwd_binaries).unwrap_or_else(|_| PathBuf::from("src-tauri").join("binaries").join(&sidecar_filename)));
    }
    let direct_binaries = PathBuf::from("binaries").join(&sidecar_filename);
    if direct_binaries.exists() {
        return Ok(std::fs::canonicalize(direct_binaries).unwrap_or_else(|_| PathBuf::from("binaries").join(&sidecar_filename)));
    }

    // 4. Fallback to Chocolatey install path in dev
    let choco_path = PathBuf::from("C:\\ProgramData\\chocolatey\\lib\\ffmpeg\\tools\\ffmpeg\\bin")
        .join(&plain_filename);
    if choco_path.exists() {
        return Ok(choco_path);
    }

    Err(MediaError::BinaryNotFound(binary_name.to_string()))
}
