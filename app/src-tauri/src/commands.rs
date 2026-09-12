use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};
use crate::errors::{ErrorDetails, MediaError};
use crate::media::binaries::resolve_binary;
use crate::media::planner::{
    apply_selected_output_path, check_conversion_plan, gif_filter_graph, plan_audio_extraction, plan_compression, plan_conversion, plan_trim,
    CompressRequest, ConversionPlanSummary, ConvertFormat, ConvertRequest, ExtractAudioRequest, TrimRequest,
    GIF_SIZE_LIMIT_BYTES,
};
use crate::media::format::format_bytes;
use crate::media::probe::{probe_media_file, MediaInfo};
use crate::media::process::{JobManager, JobResult};

pub struct AppState {
    pub job_manager: JobManager,
    pub proxy_mutex: tokio::sync::Mutex<()>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct GifSizeEstimate {
    pub estimated_size_bytes: u64,
    pub friendly_estimated_size: String,
    pub exceeds_size_limit: bool,
    pub size_limit_bytes: u64,
}

fn gif_sample_windows(duration_seconds: f64) -> Vec<(f64, f64)> {
    let sample_duration = duration_seconds.min(2.0).max(0.1);
    if duration_seconds <= 6.0 {
        return vec![(0.0, duration_seconds)];
    }

    let last_start = (duration_seconds - sample_duration).max(0.0);
    vec![(0.0, sample_duration), (last_start / 2.0, sample_duration), (last_start, sample_duration)]
}

fn estimate_gif_size(ffmpeg_bin: &Path, input_path: &Path, duration_seconds: f64) -> Result<GifSizeEstimate, MediaError> {
    if !duration_seconds.is_finite() || duration_seconds <= 0.0 {
        return Err(MediaError::InvalidMedia {
            message: "GIF size cannot be estimated without a duration.".to_string(),
            details: None,
        });
    }

    let samples = gif_sample_windows(duration_seconds);
    let run_id = format!(
        "{}_{}",
        std::process::id(),
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos()
    );
    let mut total_sample_bytes = 0u64;
    let mut total_sample_duration = 0.0;

    for (index, (start, sample_duration)) in samples.iter().enumerate() {
        let output_path = std::env::temp_dir().join(format!("clip-squeezer-gif-estimate-{run_id}-{index}.gif"));
        let output = Command::new(ffmpeg_bin)
            .args([
                "-y".to_string(),
                "-v".to_string(),
                "error".to_string(),
                "-ss".to_string(),
                format!("{start:.3}"),
                "-i".to_string(),
                input_path.to_string_lossy().to_string(),
                "-t".to_string(),
                format!("{sample_duration:.3}"),
                "-filter_complex".to_string(),
                gif_filter_graph(),
                "-map".to_string(),
                "[gif_output]".to_string(),
                "-loop".to_string(),
                "0".to_string(),
                "-an".to_string(),
                output_path.to_string_lossy().to_string(),
            ])
            .output()
            .map_err(|err| MediaError::ProcessFailed { exit_code: None, stderr: err.to_string() })?;

        if !output.status.success() {
            let _ = fs::remove_file(&output_path);
            return Err(MediaError::ProcessFailed {
                exit_code: output.status.code(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            });
        }

        let sample_size = fs::metadata(&output_path)?.len();
        let _ = fs::remove_file(&output_path);
        total_sample_bytes += sample_size;
        total_sample_duration += *sample_duration;
    }

    let estimated_size_bytes = ((total_sample_bytes as f64 * duration_seconds / total_sample_duration) * 1.25).ceil() as u64;
    Ok(GifSizeEstimate {
        estimated_size_bytes,
        friendly_estimated_size: format_bytes(estimated_size_bytes),
        exceeds_size_limit: estimated_size_bytes > GIF_SIZE_LIMIT_BYTES,
        size_limit_bytes: GIF_SIZE_LIMIT_BYTES,
    })
}

impl AppState {
    pub fn new() -> Self {
        Self {
            job_manager: JobManager::new(),
            proxy_mutex: tokio::sync::Mutex::new(()),
        }
    }
}

#[tauri::command]
pub async fn probe_media(app: AppHandle, path: String) -> Result<MediaInfo, ErrorDetails> {
    let file_path = PathBuf::from(&path);
    let ffprobe_bin = resolve_binary(&app, "ffprobe").map_err(|e| e.to_user_friendly())?;

    probe_media_file(&ffprobe_bin, &file_path).map_err(|e| e.to_user_friendly())
}

#[tauri::command]
pub fn can_write_output_next_to_source(path: String) -> bool {
    crate::files::naming::can_write_to_source_directory(Path::new(&path))
}

#[tauri::command]
pub fn suggest_output_path(path: String, filename: String) -> Result<String, ErrorDetails> {
    let filename_path = Path::new(&filename);
    if filename_path.file_name().and_then(|name| name.to_str()) != Some(filename.as_str()) {
        return Err(MediaError::InvalidOutputPath("The suggested output must be a filename.".to_string()).to_user_friendly());
    }

    Ok(crate::files::naming::resolve_collision_safe_named_path(Path::new(&path), &filename)
        .to_string_lossy()
        .to_string())
}

#[tauri::command]
pub async fn start_compression(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    job_id: Option<String>,
    path: String,
    request: CompressRequest,
    output_path: Option<String>,
) -> Result<JobResult, ErrorDetails> {
    let file_path = PathBuf::from(&path);
    let ffprobe_bin = resolve_binary(&app, "ffprobe").map_err(|e| e.to_user_friendly())?;
    let ffmpeg_bin = resolve_binary(&app, "ffmpeg").map_err(|e| e.to_user_friendly())?;

    let probe = probe_media_file(&ffprobe_bin, &file_path).map_err(|e| e.to_user_friendly())?;
    let mut plan = plan_compression(&probe, &request).map_err(|e| e.to_user_friendly())?;
    apply_selected_output_path(&mut plan, output_path.as_deref()).map_err(|e| e.to_user_friendly())?;

    let job_id = job_id.unwrap_or_else(|| {
        format!(
            "job_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
        )
    });
    let job_manager = state.job_manager.clone();
    let original_size = probe.size_bytes;

    tokio::task::spawn_blocking(move || {
        job_manager.run_job(app, job_id, &ffmpeg_bin, Some(&ffprobe_bin), &plan, original_size)
    })
    .await
    .map_err(|e| ErrorDetails {
        title: "Execution error".to_string(),
        message: "Background task crashed.".to_string(),
        technical_details: Some(e.to_string()),
    })?
    .map_err(|e| e.to_user_friendly())
}

#[tauri::command]
pub async fn check_conversion(
    app: AppHandle,
    path: String,
    format: ConvertFormat,
) -> Result<ConversionPlanSummary, ErrorDetails> {
    let file_path = PathBuf::from(&path);
    let ffprobe_bin = resolve_binary(&app, "ffprobe").map_err(|e| e.to_user_friendly())?;
    let probe = probe_media_file(&ffprobe_bin, &file_path).map_err(|e| e.to_user_friendly())?;

    Ok(check_conversion_plan(&probe, format))
}

#[tauri::command]
pub async fn estimate_gif(
    app: AppHandle,
    path: String,
) -> Result<GifSizeEstimate, ErrorDetails> {
    let file_path = PathBuf::from(path);
    let ffprobe_bin = resolve_binary(&app, "ffprobe").map_err(|e| e.to_user_friendly())?;
    let ffmpeg_bin = resolve_binary(&app, "ffmpeg").map_err(|e| e.to_user_friendly())?;
    let probe = probe_media_file(&ffprobe_bin, &file_path).map_err(|e| e.to_user_friendly())?;

    tokio::task::spawn_blocking(move || estimate_gif_size(&ffmpeg_bin, &file_path, probe.duration_seconds))
        .await
        .map_err(|e| ErrorDetails {
            title: "GIF estimate failed".to_string(),
            message: "The GIF size could not be estimated.".to_string(),
            technical_details: Some(e.to_string()),
        })?
        .map_err(|e| e.to_user_friendly())
}

#[tauri::command]
pub async fn start_conversion(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    job_id: Option<String>,
    path: String,
    request: ConvertRequest,
    output_path: Option<String>,
) -> Result<JobResult, ErrorDetails> {
    let file_path = PathBuf::from(&path);
    let ffprobe_bin = resolve_binary(&app, "ffprobe").map_err(|e| e.to_user_friendly())?;
    let ffmpeg_bin = resolve_binary(&app, "ffmpeg").map_err(|e| e.to_user_friendly())?;

    let probe = probe_media_file(&ffprobe_bin, &file_path).map_err(|e| e.to_user_friendly())?;
    let mut plan = plan_conversion(&probe, &request).map_err(|e| e.to_user_friendly())?;
    apply_selected_output_path(&mut plan, output_path.as_deref()).map_err(|e| e.to_user_friendly())?;

    let job_id = job_id.unwrap_or_else(|| {
        format!(
            "job_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
        )
    });
    let job_manager = state.job_manager.clone();
    let original_size = probe.size_bytes;

    tokio::task::spawn_blocking(move || {
        job_manager.run_job(app, job_id, &ffmpeg_bin, Some(&ffprobe_bin), &plan, original_size)
    })
    .await
    .map_err(|e| ErrorDetails {
        title: "Execution error".to_string(),
        message: "Background task crashed.".to_string(),
        technical_details: Some(e.to_string()),
    })?
    .map_err(|e| e.to_user_friendly())
}

#[tauri::command]
pub async fn start_audio_extraction(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    job_id: Option<String>,
    path: String,
    request: ExtractAudioRequest,
    output_path: Option<String>,
) -> Result<JobResult, ErrorDetails> {
    let file_path = PathBuf::from(&path);
    let ffprobe_bin = resolve_binary(&app, "ffprobe").map_err(|e| e.to_user_friendly())?;
    let ffmpeg_bin = resolve_binary(&app, "ffmpeg").map_err(|e| e.to_user_friendly())?;

    let probe = probe_media_file(&ffprobe_bin, &file_path).map_err(|e| e.to_user_friendly())?;
    let mut plan = plan_audio_extraction(&probe, &request).map_err(|e| e.to_user_friendly())?;
    apply_selected_output_path(&mut plan, output_path.as_deref()).map_err(|e| e.to_user_friendly())?;

    let job_id = job_id.unwrap_or_else(|| {
        format!(
            "job_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
        )
    });
    let job_manager = state.job_manager.clone();
    let original_size = probe.size_bytes;

    tokio::task::spawn_blocking(move || {
        job_manager.run_job(app, job_id, &ffmpeg_bin, Some(&ffprobe_bin), &plan, original_size)
    })
    .await
    .map_err(|e| ErrorDetails {
        title: "Execution error".to_string(),
        message: "Background task crashed.".to_string(),
        technical_details: Some(e.to_string()),
    })?
    .map_err(|e| e.to_user_friendly())
}

#[tauri::command]
pub async fn start_trim(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    job_id: Option<String>,
    path: String,
    request: TrimRequest,
    output_path: Option<String>,
) -> Result<JobResult, ErrorDetails> {
    let file_path = PathBuf::from(&path);
    let ffprobe_bin = resolve_binary(&app, "ffprobe").map_err(|e| e.to_user_friendly())?;
    let ffmpeg_bin = resolve_binary(&app, "ffmpeg").map_err(|e| e.to_user_friendly())?;

    let probe = probe_media_file(&ffprobe_bin, &file_path).map_err(|e| e.to_user_friendly())?;
    let mut plan = plan_trim(&probe, &request).map_err(|e| e.to_user_friendly())?;
    apply_selected_output_path(&mut plan, output_path.as_deref()).map_err(|e| e.to_user_friendly())?;

    let job_id = job_id.unwrap_or_else(|| {
        format!(
            "job_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
        )
    });
    let job_manager = state.job_manager.clone();
    let original_size = probe.size_bytes;

    tokio::task::spawn_blocking(move || {
        job_manager.run_job(app, job_id, &ffmpeg_bin, Some(&ffprobe_bin), &plan, original_size)
    })
    .await
    .map_err(|e| ErrorDetails {
        title: "Execution error".to_string(),
        message: "Background task crashed.".to_string(),
        technical_details: Some(e.to_string()),
    })?
    .map_err(|e| e.to_user_friendly())
}

#[tauri::command]
pub async fn cancel_job(
    state: State<'_, Arc<AppState>>,
    job_id: String,
    output_path: Option<String>,
) -> Result<(), ErrorDetails> {
    let path_buf = output_path.map(PathBuf::from);
    state
        .job_manager
        .cancel_job(&job_id, path_buf.as_deref())
        .map_err(|e| e.to_user_friendly())
}

#[tauri::command]
pub async fn show_in_folder(path: String) -> Result<(), ErrorDetails> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(ErrorDetails {
            title: "File not found".to_string(),
            message: "The requested file does not exist on disk.".to_string(),
            technical_details: Some(path),
        });
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let win_path = path.replace('/', "\\");
        std::process::Command::new("explorer")
            .raw_arg(format!("/select,\"{}\"", win_path))
            .spawn()
            .map_err(|e| ErrorDetails {
                title: "Failed to open folder".to_string(),
                message: "Could not open Windows Explorer.".to_string(),
                technical_details: Some(e.to_string()),
            })?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| ErrorDetails {
                title: "Failed to open folder".to_string(),
                message: "Could not reveal file in Finder.".to_string(),
                technical_details: Some(e.to_string()),
            })?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_file_path(path: String) -> Result<(), ErrorDetails> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(ErrorDetails {
            title: "File not found".to_string(),
            message: "The requested file does not exist on disk.".to_string(),
            technical_details: Some(path),
        });
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &path])
            .spawn()
            .map_err(|e| ErrorDetails {
                title: "Failed to open file".to_string(),
                message: "Could not open file in default media player.".to_string(),
                technical_details: Some(e.to_string()),
            })?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| ErrorDetails {
                title: "Failed to open file".to_string(),
                message: "Could not open file in default media player.".to_string(),
                technical_details: Some(e.to_string()),
            })?;
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| ErrorDetails {
                title: "Failed to open file".to_string(),
                message: "Could not open file in default media player.".to_string(),
                technical_details: Some(e.to_string()),
            })?;
    }

    Ok(())
}

#[tauri::command]
pub async fn ensure_preview_proxy(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    path: String,
) -> Result<String, ErrorDetails> {
    let file_path = PathBuf::from(&path);

    // Fast check: return immediately if stable cached proxy already exists
    if let Ok(proxy_dir) = crate::media::proxy::get_proxy_cache_dir(&app) {
        let hash_key = crate::media::proxy::compute_stable_hash(&file_path);
        let proxy_path = proxy_dir.join(format!("proxy_{:016x}.mp4", hash_key));
        if proxy_path.exists() {
            if let Ok(meta) = std::fs::metadata(&proxy_path) {
                if meta.len() > 1024 {
                    return Ok(proxy_path.to_string_lossy().to_string());
                }
            }
        }
    }

    // Acquire lock so concurrent requests serialize rather than generating concurrently
    let _guard = state.proxy_mutex.lock().await;

    // Double check if another worker completed it while waiting for lock
    if let Ok(proxy_dir) = crate::media::proxy::get_proxy_cache_dir(&app) {
        let hash_key = crate::media::proxy::compute_stable_hash(&file_path);
        let proxy_path = proxy_dir.join(format!("proxy_{:016x}.mp4", hash_key));
        if proxy_path.exists() {
            if let Ok(meta) = std::fs::metadata(&proxy_path) {
                if meta.len() > 1024 {
                    return Ok(proxy_path.to_string_lossy().to_string());
                }
            }
        }
    }

    let ffmpeg_bin = resolve_binary(&app, "ffmpeg").map_err(|e| e.to_user_friendly())?;
    let app_clone = app.clone();

    let proxy_path = tokio::task::spawn_blocking(move || {
        crate::media::proxy::generate_preview_proxy_file(&app_clone, &ffmpeg_bin, &file_path)
    })
    .await
    .map_err(|e| ErrorDetails {
        title: "Proxy error".to_string(),
        message: "Proxy task crashed.".to_string(),
        technical_details: Some(e.to_string()),
    })?
    .map_err(|e| e.to_user_friendly())?;

    Ok(proxy_path.to_string_lossy().to_string())
}
