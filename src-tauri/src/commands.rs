use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, State};
use crate::errors::ErrorDetails;
use crate::media::binaries::resolve_binary;
use crate::media::planner::{
    check_conversion_plan, plan_audio_extraction, plan_compression, plan_conversion, plan_trim,
    CompressRequest, ConversionPlanSummary, ConvertFormat, ConvertRequest, ExtractAudioRequest, TrimRequest,
};
use crate::media::probe::{probe_media_file, MediaInfo};
use crate::media::process::{JobManager, JobResult};

pub struct AppState {
    pub job_manager: JobManager,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            job_manager: JobManager::new(),
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
pub async fn start_compression(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    path: String,
    request: CompressRequest,
) -> Result<JobResult, ErrorDetails> {
    let file_path = PathBuf::from(&path);
    let ffprobe_bin = resolve_binary(&app, "ffprobe").map_err(|e| e.to_user_friendly())?;
    let ffmpeg_bin = resolve_binary(&app, "ffmpeg").map_err(|e| e.to_user_friendly())?;

    let probe = probe_media_file(&ffprobe_bin, &file_path).map_err(|e| e.to_user_friendly())?;
    let plan = plan_compression(&probe, &request).map_err(|e| e.to_user_friendly())?;

    let job_id = format!("job_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let job_manager = state.job_manager.clone();
    let original_size = probe.size_bytes;

    tokio::task::spawn_blocking(move || {
        job_manager.run_job(app, job_id, &ffmpeg_bin, &plan, original_size)
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
pub async fn start_conversion(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    path: String,
    request: ConvertRequest,
) -> Result<JobResult, ErrorDetails> {
    let file_path = PathBuf::from(&path);
    let ffprobe_bin = resolve_binary(&app, "ffprobe").map_err(|e| e.to_user_friendly())?;
    let ffmpeg_bin = resolve_binary(&app, "ffmpeg").map_err(|e| e.to_user_friendly())?;

    let probe = probe_media_file(&ffprobe_bin, &file_path).map_err(|e| e.to_user_friendly())?;
    let plan = plan_conversion(&probe, &request).map_err(|e| e.to_user_friendly())?;

    let job_id = format!("job_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let job_manager = state.job_manager.clone();
    let original_size = probe.size_bytes;

    tokio::task::spawn_blocking(move || {
        job_manager.run_job(app, job_id, &ffmpeg_bin, &plan, original_size)
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
    path: String,
    request: ExtractAudioRequest,
) -> Result<JobResult, ErrorDetails> {
    let file_path = PathBuf::from(&path);
    let ffprobe_bin = resolve_binary(&app, "ffprobe").map_err(|e| e.to_user_friendly())?;
    let ffmpeg_bin = resolve_binary(&app, "ffmpeg").map_err(|e| e.to_user_friendly())?;

    let probe = probe_media_file(&ffprobe_bin, &file_path).map_err(|e| e.to_user_friendly())?;
    let plan = plan_audio_extraction(&probe, &request).map_err(|e| e.to_user_friendly())?;

    let job_id = format!("job_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let job_manager = state.job_manager.clone();
    let original_size = probe.size_bytes;

    tokio::task::spawn_blocking(move || {
        job_manager.run_job(app, job_id, &ffmpeg_bin, &plan, original_size)
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
    path: String,
    request: TrimRequest,
) -> Result<JobResult, ErrorDetails> {
    let file_path = PathBuf::from(&path);
    let ffprobe_bin = resolve_binary(&app, "ffprobe").map_err(|e| e.to_user_friendly())?;
    let ffmpeg_bin = resolve_binary(&app, "ffmpeg").map_err(|e| e.to_user_friendly())?;

    let probe = probe_media_file(&ffprobe_bin, &file_path).map_err(|e| e.to_user_friendly())?;
    let plan = plan_trim(&probe, &request).map_err(|e| e.to_user_friendly())?;

    let job_id = format!("job_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let job_manager = state.job_manager.clone();
    let original_size = probe.size_bytes;

    tokio::task::spawn_blocking(move || {
        job_manager.run_job(app, job_id, &ffmpeg_bin, &plan, original_size)
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
pub async fn ensure_preview_proxy(app: AppHandle, path: String) -> Result<String, ErrorDetails> {
    let file_path = PathBuf::from(&path);
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
