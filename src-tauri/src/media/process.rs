use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::errors::MediaError;
use crate::media::format::format_bytes;
use crate::media::planner::{build_ffmpeg_args, MediaPlan};
use crate::media::progress::ProgressParser;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgressPayload {
    pub job_id: String,
    pub percent: f64,
    pub out_time_seconds: f64,
    pub speed: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobResult {
    pub output_path: String,
    pub original_size_bytes: u64,
    pub result_size_bytes: u64,
    pub friendly_original_size: String,
    pub friendly_result_size: String,
    pub savings_percent: Option<f64>,
    pub friendly_duration: Option<String>,
    pub friendly_resolution: Option<String>,
}

#[derive(Default, Clone)]
pub struct JobManager {
    children: Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>,
    cancelled_jobs: Arc<Mutex<HashSet<String>>>,
}

impl JobManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn cancel_job(&self, job_id: &str, output_path: Option<&Path>) -> Result<(), MediaError> {
        {
            let mut cancelled = self.cancelled_jobs.lock().unwrap();
            cancelled.insert(job_id.to_string());
        }

        let child_arc = {
            let mut children = self.children.lock().unwrap();
            children.remove(job_id)
        };

        if let Some(child_arc) = child_arc {
            let mut child = child_arc.lock().unwrap();
            let _ = child.kill();
        }

        // Clean up partial output file if present
        if let Some(path) = output_path {
            if path.exists() {
                let _ = fs::remove_file(path);
            }
        }

        Ok(())
    }

    pub fn is_cancelled(&self, job_id: &str) -> bool {
        self.cancelled_jobs.lock().unwrap().contains(job_id)
    }

    pub fn run_job(
        &self,
        app: AppHandle,
        job_id: String,
        ffmpeg_bin: &Path,
        ffprobe_bin: Option<&Path>,
        plan: &MediaPlan,
        original_size_bytes: u64,
    ) -> Result<JobResult, MediaError> {
        let args = build_ffmpeg_args(plan);

        let mut cmd = Command::new(ffmpeg_bin);
        cmd.args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let mut child = cmd.spawn().map_err(|e| MediaError::ProcessFailed {
            exit_code: None,
            stderr: format!("Failed to spawn ffmpeg: {}", e),
        })?;

        let stdout = child.stdout.take().ok_or_else(|| MediaError::ProcessFailed {
            exit_code: None,
            stderr: "Could not capture ffmpeg stdout".to_string(),
        })?;

        let mut stderr = child.stderr.take().ok_or_else(|| MediaError::ProcessFailed {
            exit_code: None,
            stderr: "Could not capture ffmpeg stderr".to_string(),
        })?;

        let child_arc = Arc::new(Mutex::new(child));
        {
            let mut children = self.children.lock().unwrap();
            children.insert(job_id.clone(), child_arc.clone());
        }

        // Stream stdout in current thread (caller runs in spawn_blocking)
        let mut reader = BufReader::new(stdout);
        let mut progress_parser = ProgressParser::new();
        let mut line_buf = String::new();

        while let Ok(bytes_read) = reader.read_line(&mut line_buf) {
            if bytes_read == 0 {
                break;
            }

            if self.is_cancelled(&job_id) {
                break;
            }

            if let Some(update) = progress_parser.parse_line(&line_buf, plan.expected_duration) {
                let payload = JobProgressPayload {
                    job_id: job_id.clone(),
                    percent: update.percent,
                    out_time_seconds: update.out_time_seconds,
                    speed: update.speed,
                };
                let _ = app.emit("job-progress", payload);
            }

            line_buf.clear();
        }

        // Wait for process completion
        let status = {
            let mut child = child_arc.lock().unwrap();
            child.wait()
        };

        // Clean up from active map
        {
            let mut children = self.children.lock().unwrap();
            children.remove(&job_id);
        }

        if self.is_cancelled(&job_id) {
            if plan.output_path.exists() {
                let _ = fs::remove_file(&plan.output_path);
            }
            return Err(MediaError::Cancelled);
        }

        let status = status.map_err(|e| MediaError::ProcessFailed {
            exit_code: None,
            stderr: e.to_string(),
        })?;

        if !status.success() {
            let mut stderr_content = String::new();
            let _ = stderr.read_to_string(&mut stderr_content);

            // Clean up failed output if any
            if plan.output_path.exists() {
                let _ = fs::remove_file(&plan.output_path);
            }

            return Err(MediaError::ProcessFailed {
                exit_code: status.code(),
                stderr: stderr_content,
            });
        }

        // Validate output
        if !plan.output_path.exists() {
            return Err(MediaError::OutputValidationFailed(
                "Output file was not created by FFmpeg.".to_string(),
            ));
        }

        let metadata = fs::metadata(&plan.output_path).map_err(|e| {
            MediaError::OutputValidationFailed(format!("Failed to read output metadata: {}", e))
        })?;

        let result_size_bytes = metadata.len();
        if result_size_bytes == 0 {
            let _ = fs::remove_file(&plan.output_path);
            return Err(MediaError::OutputValidationFailed(
                "Resulting output file is empty (0 bytes).".to_string(),
            ));
        }

        let friendly_original_size = format_bytes(original_size_bytes);
        let friendly_result_size = format_bytes(result_size_bytes);

        let savings_percent = if original_size_bytes > result_size_bytes {
            let diff = (original_size_bytes - result_size_bytes) as f64;
            Some(((diff / (original_size_bytes as f64)) * 100.0).round())
        } else {
            None
        };

        let (friendly_duration, friendly_resolution) = if let Some(probe_bin) = ffprobe_bin {
            if let Ok(info) = crate::media::probe::probe_media_file(probe_bin, &plan.output_path) {
                let res = if info.friendly_resolution.is_empty() {
                    None
                } else {
                    Some(info.friendly_resolution)
                };
                (Some(info.friendly_duration), res)
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        Ok(JobResult {
            output_path: plan.output_path.to_string_lossy().to_string(),
            original_size_bytes,
            result_size_bytes,
            friendly_original_size,
            friendly_result_size,
            savings_percent,
            friendly_duration,
            friendly_resolution,
        })
    }
}
