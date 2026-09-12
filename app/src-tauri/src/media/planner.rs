use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use crate::errors::MediaError;
use crate::files::naming::resolve_collision_safe_path;
use crate::media::probe::MediaInfo;

pub const GIF_MAX_LONG_EDGE: u32 = 640;
pub const GIF_FRAME_RATE: u32 = 12;
pub const GIF_SIZE_LIMIT_BYTES: u64 = 25 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CompressQuality {
    BestQuality,
    Balanced,
    SmallestFile,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CompressResolution {
    KeepOriginal,
    P1080,
    P720,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CompressCompatibility {
    Wide,        // H.264
    SmallerFile, // HEVC / H.265
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressRequest {
    pub quality: CompressQuality,
    pub resolution: CompressResolution,
    pub compatibility: CompressCompatibility,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConvertFormat {
    Mp4,
    Mov,
    Mkv,
    Webm,
    Gif,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvertRequest {
    pub format: ConvertFormat,
    /// GIFs larger than the sharing-friendly limit need an explicit confirmation in the UI.
    #[serde(default, alias = "allowLargeGif")]
    pub allow_large_gif: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversionPlanSummary {
    pub is_remux: bool,
    pub video_action: String,
    pub audio_action: String,
    pub target_ext: String,
    pub message: String,
}

/// The filter graph used for both a real GIF and its preflight samples. Keeping it in one
/// place means the estimate describes the file the user will actually receive.
pub fn gif_filter_graph() -> String {
    format!(
        "[0:v]fps={GIF_FRAME_RATE},scale={GIF_MAX_LONG_EDGE}:{GIF_MAX_LONG_EDGE}:force_original_aspect_ratio=decrease:flags=lanczos,split=2[gif_frames][gif_palette_source];[gif_palette_source]palettegen=stats_mode=diff[gif_palette];[gif_frames][gif_palette]paletteuse=dither=sierra2_4a[gif_output]"
    )
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExtractAudioMode {
    OriginalQuality,
    Mp3,
    M4a,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractAudioRequest {
    pub mode: ExtractAudioMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrimRequest {
    pub start_seconds: f64,
    pub end_seconds: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum VideoStrategy {
    Copy,
    Transcode {
        codec: String,
        crf: u32,
        preset: String,
        pixel_format: String,
    },
    Omit,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AudioStrategy {
    Copy,
    Transcode {
        codec: String,
        bitrate_kbps: u32,
    },
    Omit,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MediaPlan {
    pub input_path: PathBuf,
    pub output_path: PathBuf,
    pub video_strategy: VideoStrategy,
    pub audio_strategy: AudioStrategy,
    pub video_filter: Option<String>,
    pub filter_complex: Option<String>,
    pub video_map: Option<String>,
    pub max_output_size_bytes: Option<u64>,
    pub seek_start: Option<f64>,
    pub duration_limit: Option<f64>,
    pub faststart: bool,
    pub expected_duration: f64,
    pub is_remux: bool,
}

/// Apply the output file chosen by the user after a plan has supplied its
/// collision-safe default. The planner remains responsible for its default;
/// this only replaces it when the user explicitly chooses another location.
pub fn apply_selected_output_path(
    plan: &mut MediaPlan,
    selected_output_path: Option<&str>,
) -> Result<(), MediaError> {
    let Some(selected_output_path) = selected_output_path else {
        return Ok(());
    };

    let output_path = PathBuf::from(selected_output_path);
    let canonical_input = plan.input_path.canonicalize().ok();
    let canonical_output = output_path.canonicalize().ok();
    let is_source_file = output_path == plan.input_path
        || matches!((canonical_input, canonical_output), (Some(input), Some(output)) if input == output)
        || paths_refer_to_same_file(&plan.input_path, &output_path);

    if is_source_file {
        return Err(MediaError::InvalidOutputPath(
            "The selected output file is the source media file.".to_string(),
        ));
    }

    let expected_extension = plan.output_path.extension().and_then(|extension| extension.to_str());
    let selected_extension = output_path.extension().and_then(|extension| extension.to_str());
    if expected_extension.map(str::to_ascii_lowercase) != selected_extension.map(str::to_ascii_lowercase) {
        return Err(MediaError::InvalidOutputPath(format!(
            "The selected output file must use the .{} extension.",
            expected_extension.unwrap_or_default()
        )));
    }

    plan.output_path = output_path;
    Ok(())
}

fn paths_refer_to_same_file(input_path: &std::path::Path, output_path: &std::path::Path) -> bool {
    same_file::is_same_file(input_path, output_path).unwrap_or(false)
}

#[cfg(test)]
mod output_path_tests {
    use super::*;

    fn plan() -> MediaPlan {
        MediaPlan {
            input_path: PathBuf::from("/videos/input.mp4"),
            output_path: PathBuf::from("/videos/input-smaller.mp4"),
            video_strategy: VideoStrategy::Omit,
            audio_strategy: AudioStrategy::Omit,
            video_filter: None,
            filter_complex: None,
            video_map: None,
            max_output_size_bytes: None,
            seek_start: None,
            duration_limit: None,
            faststart: false,
            expected_duration: 0.0,
            is_remux: false,
        }
    }

    #[test]
    fn keeps_the_collision_safe_default_when_no_output_file_is_selected() {
        let mut media_plan = plan();

        apply_selected_output_path(&mut media_plan, None).unwrap();

        assert_eq!(media_plan.output_path, PathBuf::from("/videos/input-smaller.mp4"));
    }

    #[test]
    fn uses_the_file_selected_by_the_user() {
        let mut media_plan = plan();

        apply_selected_output_path(&mut media_plan, Some("/exports/smaller-video.mp4")).unwrap();

        assert_eq!(media_plan.output_path, PathBuf::from("/exports/smaller-video.mp4"));
    }

    #[test]
    fn rejects_the_source_file_as_the_selected_output() {
        let mut media_plan = plan();

        let error = apply_selected_output_path(&mut media_plan, Some("/videos/input.mp4"))
            .unwrap_err();

        assert!(matches!(error, MediaError::InvalidOutputPath(_)));
    }

    #[test]
    fn rejects_an_output_with_a_different_extension() {
        let mut media_plan = plan();

        let error = apply_selected_output_path(&mut media_plan, Some("/exports/smaller-video.mkv"))
            .unwrap_err();

        assert!(matches!(error, MediaError::InvalidOutputPath(_)));
    }

    #[test]
    fn rejects_a_hard_link_to_the_source_file() {
        let directory = std::env::temp_dir().join(format!(
            "clip-squeezer-output-link-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&directory).unwrap();
        let source = directory.join("input.mp4");
        let linked_output = directory.join("different-name.mp4");
        std::fs::write(&source, "source media").unwrap();
        std::fs::hard_link(&source, &linked_output).unwrap();
        let mut media_plan = plan();
        media_plan.input_path = source;

        let error = apply_selected_output_path(
            &mut media_plan,
            Some(linked_output.to_str().unwrap()),
        )
        .unwrap_err();

        assert!(matches!(error, MediaError::InvalidOutputPath(_)));
        std::fs::remove_dir_all(directory).unwrap();
    }
}

pub fn calculate_scale_filter(current_w: u32, current_h: u32, target: CompressResolution) -> Option<String> {
    if target == CompressResolution::KeepOriginal || current_w == 0 || current_h == 0 {
        return None;
    }

    let is_landscape = current_w >= current_h;

    match target {
        CompressResolution::P1080 => {
            if is_landscape {
                if current_h > 1080 {
                    Some("scale=-2:1080".to_string())
                } else {
                    None // Never upscale
                }
            } else {
                if current_w > 1080 {
                    Some("scale=1080:-2".to_string())
                } else {
                    None
                }
            }
        }
        CompressResolution::P720 => {
            if is_landscape {
                if current_h > 720 {
                    Some("scale=-2:720".to_string())
                } else {
                    None
                }
            } else {
                if current_w > 720 {
                    Some("scale=720:-2".to_string())
                } else {
                    None
                }
            }
        }
        CompressResolution::KeepOriginal => None,
    }
}

pub fn plan_compression(probe: &MediaInfo, req: &CompressRequest) -> Result<MediaPlan, MediaError> {
    if !probe.has_video {
        return Err(MediaError::NoVideoStream);
    }

    let input_path = PathBuf::from(&probe.path);
    let output_path = resolve_collision_safe_path(&input_path, "-smaller", "mp4");

    let (codec, crf) = match (req.compatibility, req.quality) {
        (CompressCompatibility::Wide, CompressQuality::BestQuality) => ("libx264".to_string(), 18),
        (CompressCompatibility::Wide, CompressQuality::Balanced) => ("libx264".to_string(), 23),
        (CompressCompatibility::Wide, CompressQuality::SmallestFile) => ("libx264".to_string(), 28),
        (CompressCompatibility::SmallerFile, CompressQuality::BestQuality) => ("libx265".to_string(), 20),
        (CompressCompatibility::SmallerFile, CompressQuality::Balanced) => ("libx265".to_string(), 26),
        (CompressCompatibility::SmallerFile, CompressQuality::SmallestFile) => ("libx265".to_string(), 30),
    };

    let video_strategy = VideoStrategy::Transcode {
        codec,
        crf,
        preset: "medium".to_string(),
        pixel_format: "yuv420p".to_string(),
    };

    let audio_strategy = if probe.has_audio {
        AudioStrategy::Transcode {
            codec: "aac".to_string(),
            bitrate_kbps: 128,
        }
    } else {
        AudioStrategy::Omit
    };

    let video_stream = probe.video_streams.first().ok_or(MediaError::NoVideoStream)?;
    let video_filter = calculate_scale_filter(video_stream.width, video_stream.height, req.resolution);

    Ok(MediaPlan {
        input_path,
        output_path,
        video_strategy,
        audio_strategy,
        video_filter,
        filter_complex: None,
        video_map: None,
        max_output_size_bytes: None,
        seek_start: None,
        duration_limit: None,
        faststart: true,
        expected_duration: probe.duration_seconds,
        is_remux: false,
    })
}

pub fn plan_conversion(probe: &MediaInfo, req: &ConvertRequest) -> Result<MediaPlan, MediaError> {
    if !probe.has_video {
        return Err(MediaError::NoVideoStream);
    }

    let input_path = PathBuf::from(&probe.path);
    let v_stream = probe.video_streams.first().ok_or(MediaError::NoVideoStream)?;
    let v_codec = v_stream.codec.to_lowercase();
    let a_codec = probe.audio_streams.first().map(|s| s.codec.to_lowercase());

    let (ext, can_copy_v, fallback_v, can_copy_a, fallback_a, faststart) = match req.format {
        ConvertFormat::Mp4 => {
            let copy_v = matches!(v_codec.as_str(), "h264" | "hevc" | "h265" | "av1" | "mpeg4");
            let copy_a = a_codec.as_deref().map_or(true, |a| matches!(a, "aac" | "mp3" | "alac"));
            (
                "mp4",
                copy_v,
                VideoStrategy::Transcode {
                    codec: "libx264".to_string(),
                    crf: 21,
                    preset: "medium".to_string(),
                    pixel_format: "yuv420p".to_string(),
                },
                copy_a,
                AudioStrategy::Transcode {
                    codec: "aac".to_string(),
                    bitrate_kbps: 160,
                },
                true,
            )
        }
        ConvertFormat::Mov => {
            let copy_v = matches!(v_codec.as_str(), "h264" | "hevc" | "h265" | "prores" | "dnxhd" | "mjpeg");
            let copy_a = a_codec.as_deref().map_or(true, |a| matches!(a, "aac" | "alac" | "pcm_s16le" | "pcm_s24le" | "mp3"));
            (
                "mov",
                copy_v,
                VideoStrategy::Transcode {
                    codec: "libx264".to_string(),
                    crf: 21,
                    preset: "medium".to_string(),
                    pixel_format: "yuv420p".to_string(),
                },
                copy_a,
                AudioStrategy::Transcode {
                    codec: "aac".to_string(),
                    bitrate_kbps: 160,
                },
                false,
            )
        }
        ConvertFormat::Mkv => {
            let copy_v = matches!(v_codec.as_str(), "h264" | "hevc" | "h265" | "vp8" | "vp9" | "av1" | "prores" | "theora" | "mpeg4");
            let copy_a = a_codec.as_deref().map_or(true, |a| matches!(a, "aac" | "opus" | "vorbis" | "flac" | "mp3" | "ac3" | "eac3" | "pcm_s16le" | "pcm_s24le"));
            (
                "mkv",
                copy_v,
                VideoStrategy::Transcode {
                    codec: "libx264".to_string(),
                    crf: 21,
                    preset: "medium".to_string(),
                    pixel_format: "yuv420p".to_string(),
                },
                copy_a,
                AudioStrategy::Transcode {
                    codec: "aac".to_string(),
                    bitrate_kbps: 160,
                },
                false,
            )
        }
        ConvertFormat::Webm => {
            let copy_v = matches!(v_codec.as_str(), "vp8" | "vp9" | "av1");
            let copy_a = a_codec.as_deref().map_or(true, |a| matches!(a, "opus" | "vorbis"));
            (
                "webm",
                copy_v,
                VideoStrategy::Transcode {
                    codec: "libvpx-vp9".to_string(),
                    crf: 30,
                    preset: "medium".to_string(),
                    pixel_format: "yuv420p".to_string(),
                },
                copy_a,
                AudioStrategy::Transcode {
                    codec: "libopus".to_string(),
                    bitrate_kbps: 128,
                },
                false,
            )
        }
        ConvertFormat::Gif => (
            "gif",
            false,
            VideoStrategy::Transcode {
                codec: "gif".to_string(),
                crf: 0,
                preset: "".to_string(),
                pixel_format: "".to_string(),
            },
            false,
            AudioStrategy::Omit,
            false,
        ),
    };

    let video_strategy = if can_copy_v {
        VideoStrategy::Copy
    } else {
        fallback_v
    };

    let audio_strategy = if req.format == ConvertFormat::Gif || !probe.has_audio {
        AudioStrategy::Omit
    } else if can_copy_a {
        AudioStrategy::Copy
    } else {
        fallback_a
    };

    let is_remux = matches!(video_strategy, VideoStrategy::Copy)
        && matches!(audio_strategy, AudioStrategy::Copy | AudioStrategy::Omit);

    let output_path = resolve_collision_safe_path(&input_path, "-converted", ext);

    Ok(MediaPlan {
        input_path,
        output_path,
        video_strategy,
        audio_strategy,
        video_filter: None,
        filter_complex: if req.format == ConvertFormat::Gif {
            Some(gif_filter_graph())
        } else {
            None
        },
        video_map: if req.format == ConvertFormat::Gif {
            Some("[gif_output]".to_string())
        } else {
            None
        },
        max_output_size_bytes: if req.format == ConvertFormat::Gif && !req.allow_large_gif {
            Some(GIF_SIZE_LIMIT_BYTES)
        } else {
            None
        },
        seek_start: None,
        duration_limit: None,
        faststart,
        expected_duration: probe.duration_seconds,
        is_remux,
    })
}

pub fn plan_audio_extraction(probe: &MediaInfo, req: &ExtractAudioRequest) -> Result<MediaPlan, MediaError> {
    if !probe.has_audio {
        return Err(MediaError::NoAudioStream);
    }

    let a_stream = probe.audio_streams.first().ok_or(MediaError::NoAudioStream)?;
    let a_codec = a_stream.codec.to_lowercase();
    let input_path = PathBuf::from(&probe.path);

    let (ext, audio_strategy) = match req.mode {
        ExtractAudioMode::OriginalQuality => {
            match a_codec.as_str() {
                "aac" => ("m4a", AudioStrategy::Copy),
                "mp3" => ("mp3", AudioStrategy::Copy),
                "opus" => ("opus", AudioStrategy::Copy),
                "flac" => ("flac", AudioStrategy::Copy),
                "vorbis" => ("ogg", AudioStrategy::Copy),
                _ => ("m4a", AudioStrategy::Transcode {
                    codec: "aac".to_string(),
                    bitrate_kbps: 192,
                }),
            }
        }
        ExtractAudioMode::Mp3 => {
            if a_codec == "mp3" {
                ("mp3", AudioStrategy::Copy)
            } else {
                ("mp3", AudioStrategy::Transcode {
                    codec: "libmp3lame".to_string(),
                    bitrate_kbps: 192,
                })
            }
        }
        ExtractAudioMode::M4a => {
            if a_codec == "aac" {
                ("m4a", AudioStrategy::Copy)
            } else {
                ("m4a", AudioStrategy::Transcode {
                    codec: "aac".to_string(),
                    bitrate_kbps: 160,
                })
            }
        }
    };

    let output_path = resolve_collision_safe_path(&input_path, "-audio", ext);
    let is_remux = matches!(audio_strategy, AudioStrategy::Copy);

    Ok(MediaPlan {
        input_path,
        output_path,
        video_strategy: VideoStrategy::Omit,
        audio_strategy,
        video_filter: None,
        filter_complex: None,
        video_map: None,
        max_output_size_bytes: None,
        seek_start: None,
        duration_limit: None,
        faststart: false,
        expected_duration: a_stream.duration_seconds.unwrap_or(probe.duration_seconds),
        is_remux,
    })
}

pub fn plan_trim(probe: &MediaInfo, req: &TrimRequest) -> Result<MediaPlan, MediaError> {
    if !probe.has_video {
        return Err(MediaError::NoVideoStream);
    }

    if req.start_seconds < 0.0 || req.end_seconds <= req.start_seconds || req.end_seconds > (probe.duration_seconds + 0.5) {
        return Err(MediaError::InvalidTrimBounds(format!(
            "Invalid trim bounds: start={:.2}s, end={:.2}s for duration={:.2}s",
            req.start_seconds, req.end_seconds, probe.duration_seconds
        )));
    }

    let input_path = PathBuf::from(&probe.path);
    let target_duration = req.end_seconds - req.start_seconds;

    let ext = input_path.extension().and_then(|e| e.to_str()).unwrap_or("mp4").to_lowercase();
    let (target_ext, video_strategy, audio_strategy, faststart) = if ext == "webm" {
        (
            "webm",
            VideoStrategy::Transcode {
                codec: "libvpx-vp9".to_string(),
                crf: 28,
                preset: "medium".to_string(),
                pixel_format: "yuv420p".to_string(),
            },
            AudioStrategy::Transcode {
                codec: "libopus".to_string(),
                bitrate_kbps: 128,
            },
            false,
        )
    } else {
        (
            if ext == "mov" { "mov" } else if ext == "mkv" { "mkv" } else { "mp4" },
            VideoStrategy::Transcode {
                codec: "libx264".to_string(),
                crf: 18,
                preset: "medium".to_string(),
                pixel_format: "yuv420p".to_string(),
            },
            AudioStrategy::Transcode {
                codec: "aac".to_string(),
                bitrate_kbps: 160,
            },
            ext == "mp4",
        )
    };

    let output_path = resolve_collision_safe_path(&input_path, "-trimmed", target_ext);

    Ok(MediaPlan {
        input_path,
        output_path,
        video_strategy,
        audio_strategy: if probe.has_audio { audio_strategy } else { AudioStrategy::Omit },
        video_filter: None,
        filter_complex: None,
        video_map: None,
        max_output_size_bytes: None,
        seek_start: Some(req.start_seconds),
        duration_limit: Some(target_duration),
        faststart,
        expected_duration: target_duration,
        is_remux: false,
    })
}

pub fn check_conversion_plan(probe: &MediaInfo, format: ConvertFormat) -> ConversionPlanSummary {
    let req = ConvertRequest { format, allow_large_gif: false };
    let plan = plan_conversion(probe, &req);

    match plan {
        Ok(p) => {
            let video_action = match p.video_strategy {
                VideoStrategy::Copy => "copy".to_string(),
                VideoStrategy::Transcode { .. } => "transcode".to_string(),
                VideoStrategy::Omit => "omit".to_string(),
            };
            let audio_action = match p.audio_strategy {
                AudioStrategy::Copy => "copy".to_string(),
                AudioStrategy::Transcode { .. } => "transcode".to_string(),
                AudioStrategy::Omit => "none".to_string(),
            };
            let ext = p.output_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_string();

            let message = if req.format == ConvertFormat::Gif {
                "Made for short clips\nGIFs loop automatically and are easy to share, but can be much larger than MP4 or WebM.".to_string()
            } else if p.is_remux {
                "No quality change — This conversion can be completed without re-encoding the video.".to_string()
            } else {
                "The video needs converting — This will take longer because the video format needs to change.".to_string()
            };

            ConversionPlanSummary {
                is_remux: p.is_remux,
                video_action,
                audio_action,
                target_ext: ext,
                message,
            }
        }
        Err(_) => ConversionPlanSummary {
            is_remux: false,
            video_action: "transcode".to_string(),
            audio_action: "transcode".to_string(),
            target_ext: "mp4".to_string(),
            message: "The video will be converted.".to_string(),
        },
    }
}

pub fn build_ffmpeg_args(plan: &MediaPlan) -> Vec<String> {
    let mut args = Vec::new();
    args.push("-y".to_string());
    args.push("-v".to_string());
    args.push("error".to_string());
    args.push("-progress".to_string());
    args.push("pipe:1".to_string());
    args.push("-nostats".to_string());

    if let Some(ss) = plan.seek_start {
        args.push("-ss".to_string());
        args.push(format!("{:.3}", ss));
    }

    args.push("-i".to_string());
    args.push(plan.input_path.to_string_lossy().to_string());

    if let Some(t) = plan.duration_limit {
        args.push("-t".to_string());
        args.push(format!("{:.3}", t));
    }

    if let Some(filter_complex) = &plan.filter_complex {
        args.push("-filter_complex".to_string());
        args.push(filter_complex.clone());
    }

    match &plan.video_strategy {
        VideoStrategy::Copy => {
            args.push("-c:v".to_string());
            args.push("copy".to_string());
        }
        VideoStrategy::Transcode { codec, crf, preset, pixel_format } => {
            args.push("-c:v".to_string());
            args.push(codec.clone());
            if codec == "gif" {
                args.push("-loop".to_string());
                args.push("0".to_string());
            } else {
                args.push("-crf".to_string());
                args.push(crf.to_string());
                if codec == "libvpx-vp9" {
                    args.push("-b:v".to_string());
                    args.push("0".to_string());
                } else {
                    args.push("-preset".to_string());
                    args.push(preset.clone());
                }
                args.push("-pix_fmt".to_string());
                args.push(pixel_format.clone());
            }
        }
        VideoStrategy::Omit => {
            args.push("-vn".to_string());
        }
    }

    if let Some(filter) = &plan.video_filter {
        args.push("-vf".to_string());
        args.push(filter.clone());
    }

    if let Some(video_map) = &plan.video_map {
        args.push("-map".to_string());
        args.push(video_map.clone());
    }

    match &plan.audio_strategy {
        AudioStrategy::Copy => {
            args.push("-c:a".to_string());
            args.push("copy".to_string());
        }
        AudioStrategy::Transcode { codec, bitrate_kbps } => {
            args.push("-c:a".to_string());
            args.push(codec.clone());
            args.push("-b:a".to_string());
            args.push(format!("{}k", bitrate_kbps));
        }
        AudioStrategy::Omit => {
            args.push("-an".to_string());
        }
    }

    if plan.faststart {
        args.push("-movflags".to_string());
        args.push("+faststart".to_string());
    }

    args.push(plan.output_path.to_string_lossy().to_string());
    args
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media::probe::{AudioStreamInfo, VideoStreamInfo};

    fn sample_4k_probe() -> MediaInfo {
        MediaInfo {
            path: "C:\\videos\\nature.mov".to_string(),
            filename: "nature.mov".to_string(),
            container: Some("mov".to_string()),
            duration_seconds: 60.0,
            size_bytes: 500_000_000,
            video_streams: vec![VideoStreamInfo {
                codec: "h264".to_string(),
                width: 3840,
                height: 2160,
                frame_rate: Some(30.0),
                pixel_format: Some("yuv420p".to_string()),
                rotation: 0,
                duration_seconds: Some(60.0),
            }],
            audio_streams: vec![AudioStreamInfo {
                codec: "aac".to_string(),
                channels: 2,
                sample_rate: 48000,
                language: None,
                duration_seconds: Some(60.0),
            }],
            friendly_duration: "1 min".to_string(),
            friendly_resolution: "4K".to_string(),
            friendly_size: "500 MB".to_string(),
            has_video: true,
            has_audio: true,
        }
    }

    #[test]
    fn test_plan_compression_h264_balanced_1080p() {
        let probe = sample_4k_probe();
        let req = CompressRequest {
            quality: CompressQuality::Balanced,
            resolution: CompressResolution::P1080,
            compatibility: CompressCompatibility::Wide,
        };

        let plan = plan_compression(&probe, &req).expect("Planning should succeed");

        assert_eq!(
            plan.video_strategy,
            VideoStrategy::Transcode {
                codec: "libx264".to_string(),
                crf: 23,
                preset: "medium".to_string(),
                pixel_format: "yuv420p".to_string()
            }
        );
        assert_eq!(plan.video_filter, Some("scale=-2:1080".to_string()));
        assert_eq!(
            plan.audio_strategy,
            AudioStrategy::Transcode {
                codec: "aac".to_string(),
                bitrate_kbps: 128
            }
        );
        assert!(plan.faststart);
        assert_eq!(plan.output_path, PathBuf::from("C:\\videos\\nature-smaller.mp4"));

        let args = build_ffmpeg_args(&plan);
        assert!(args.contains(&"-crf".to_string()));
        assert!(args.contains(&"23".to_string()));
        assert!(args.contains(&"scale=-2:1080".to_string()));
        assert!(args.contains(&"+faststart".to_string()));
    }

    #[test]
    fn test_plan_compression_never_upscale() {
        let mut probe = sample_4k_probe();
        probe.video_streams[0].width = 1280;
        probe.video_streams[0].height = 720;

        let req = CompressRequest {
            quality: CompressQuality::BestQuality,
            resolution: CompressResolution::P1080,
            compatibility: CompressCompatibility::SmallerFile,
        };

        let plan = plan_compression(&probe, &req).expect("Planning should succeed");

        assert_eq!(plan.video_filter, None);
        assert_eq!(
            plan.video_strategy,
            VideoStrategy::Transcode {
                codec: "libx265".to_string(),
                crf: 20,
                preset: "medium".to_string(),
                pixel_format: "yuv420p".to_string()
            }
        );
    }

    #[test]
    fn test_plan_compression_portrait_4k() {
        let mut probe = sample_4k_probe();
        probe.video_streams[0].width = 2160;
        probe.video_streams[0].height = 3840;

        let req = CompressRequest {
            quality: CompressQuality::SmallestFile,
            resolution: CompressResolution::P1080,
            compatibility: CompressCompatibility::Wide,
        };

        let plan = plan_compression(&probe, &req).expect("Planning should succeed");
        assert_eq!(plan.video_filter, Some("scale=1080:-2".to_string()));
    }

    #[test]
    fn test_plan_conversion_mkv_to_mp4_remux() {
        let mut probe = sample_4k_probe();
        probe.container = Some("matroska".to_string());
        probe.path = "C:\\movies\\clip.mkv".to_string();
        probe.video_streams[0].codec = "h264".to_string();
        probe.audio_streams[0].codec = "aac".to_string();

        let req = ConvertRequest { format: ConvertFormat::Mp4, allow_large_gif: false };
        let plan = plan_conversion(&probe, &req).expect("Convert plan");

        assert_eq!(plan.video_strategy, VideoStrategy::Copy);
        assert_eq!(plan.audio_strategy, AudioStrategy::Copy);
        assert!(plan.is_remux);
        assert_eq!(plan.output_path, PathBuf::from("C:\\movies\\clip-converted.mp4"));
        assert!(plan.faststart);

        let summary = check_conversion_plan(&probe, ConvertFormat::Mp4);
        assert!(summary.is_remux);
        assert!(summary.message.contains("without re-encoding"));
    }

    #[test]
    fn test_plan_conversion_webm_to_mp4_transcode() {
        let mut probe = sample_4k_probe();
        probe.container = Some("matroska,webm".to_string());
        probe.path = "C:\\movies\\clip.webm".to_string();
        probe.video_streams[0].codec = "vp9".to_string();
        probe.audio_streams[0].codec = "opus".to_string();

        let req = ConvertRequest { format: ConvertFormat::Mp4, allow_large_gif: false };
        let plan = plan_conversion(&probe, &req).expect("Convert plan");

        assert!(!plan.is_remux);
        assert_eq!(
            plan.video_strategy,
            VideoStrategy::Transcode {
                codec: "libx264".to_string(),
                crf: 21,
                preset: "medium".to_string(),
                pixel_format: "yuv420p".to_string(),
            }
        );
        assert_eq!(
            plan.audio_strategy,
            AudioStrategy::Transcode {
                codec: "aac".to_string(),
                bitrate_kbps: 160,
            }
        );
    }

    #[test]
    fn test_plan_audio_extraction_no_audio() {
        let mut probe = sample_4k_probe();
        probe.has_audio = false;
        probe.audio_streams.clear();

        let req = ExtractAudioRequest { mode: ExtractAudioMode::Mp3 };
        let res = plan_audio_extraction(&probe, &req);
        assert!(matches!(res, Err(MediaError::NoAudioStream)));
    }

    #[test]
    fn test_plan_audio_extraction_original_aac_to_m4a() {
        let probe = sample_4k_probe(); // audio is aac
        let req = ExtractAudioRequest { mode: ExtractAudioMode::OriginalQuality };
        let plan = plan_audio_extraction(&probe, &req).expect("Extract audio plan");

        assert_eq!(plan.video_strategy, VideoStrategy::Omit);
        assert_eq!(plan.audio_strategy, AudioStrategy::Copy);
        assert_eq!(plan.output_path, PathBuf::from("C:\\videos\\nature-audio.m4a"));
        assert!(plan.is_remux);

        let args = build_ffmpeg_args(&plan);
        assert!(args.contains(&"-vn".to_string()));
        assert!(args.contains(&"-c:a".to_string()));
        assert!(args.contains(&"copy".to_string()));
    }

    #[test]
    fn test_plan_audio_extraction_mp3_transcode() {
        let probe = sample_4k_probe(); // audio is aac
        let req = ExtractAudioRequest { mode: ExtractAudioMode::Mp3 };
        let plan = plan_audio_extraction(&probe, &req).expect("Extract audio plan");

        assert_eq!(plan.video_strategy, VideoStrategy::Omit);
        assert_eq!(
            plan.audio_strategy,
            AudioStrategy::Transcode {
                codec: "libmp3lame".to_string(),
                bitrate_kbps: 192,
            }
        );
        assert_eq!(plan.output_path, PathBuf::from("C:\\videos\\nature-audio.mp3"));
    }

    #[test]
    fn test_plan_trim_bounds_validation() {
        let probe = sample_4k_probe(); // duration 60.0
        let valid_req = TrimRequest { start_seconds: 5.0, end_seconds: 25.0 };
        let plan = plan_trim(&probe, &valid_req).expect("Trim plan");

        assert_eq!(plan.seek_start, Some(5.0));
        assert_eq!(plan.duration_limit, Some(20.0));
        assert_eq!(plan.expected_duration, 20.0);
        assert_eq!(plan.output_path, PathBuf::from("C:\\videos\\nature-trimmed.mov"));

        let invalid_req = TrimRequest { start_seconds: 40.0, end_seconds: 30.0 };
        assert!(plan_trim(&probe, &invalid_req).is_err());

        let out_of_bounds = TrimRequest { start_seconds: 10.0, end_seconds: 90.0 };
        assert!(plan_trim(&probe, &out_of_bounds).is_err());
    }

    #[test]
    fn test_plan_conversion_to_gif() {
        let probe = sample_4k_probe();
        let req = ConvertRequest { format: ConvertFormat::Gif, allow_large_gif: false };
        let plan = plan_conversion(&probe, &req).expect("Gif plan");

        assert_eq!(plan.video_strategy, VideoStrategy::Transcode {
            codec: "gif".to_string(),
            crf: 0,
            preset: "".to_string(),
            pixel_format: "".to_string(),
        });
        assert_eq!(plan.audio_strategy, AudioStrategy::Omit);
        assert_eq!(plan.output_path, PathBuf::from("C:\\videos\\nature-converted.gif"));
        assert!(!plan.is_remux);

        let args = build_ffmpeg_args(&plan);
        assert!(args.contains(&"-c:v".to_string()));
        assert!(args.contains(&"gif".to_string()));
        assert!(args.contains(&"-loop".to_string()));
        assert!(args.contains(&"0".to_string()));
        assert!(args.contains(&"-an".to_string()));
        assert!(args.contains(&"-filter_complex".to_string()));
        assert!(args.iter().any(|arg| arg.contains("palettegen")));
        assert!(args.iter().any(|arg| arg.contains("fps=12")));
        assert!(args.iter().any(|arg| arg.contains("scale=640:640")));
        assert!(args.contains(&"[gif_output]".to_string()));
        assert_eq!(plan.max_output_size_bytes, Some(GIF_SIZE_LIMIT_BYTES));

        let summary = check_conversion_plan(&probe, ConvertFormat::Gif);
        assert!(!summary.is_remux);
        assert_eq!(summary.target_ext, "gif");
        assert!(summary.message.contains("Made for short clips"));
    }

    #[test]
    fn test_large_gif_confirmation_removes_output_limit() {
        let probe = sample_4k_probe();
        let req = ConvertRequest { format: ConvertFormat::Gif, allow_large_gif: true };

        let plan = plan_conversion(&probe, &req).expect("GIF plan");

        assert_eq!(plan.max_output_size_bytes, None);
        assert!(plan.filter_complex.is_some());
    }
}
