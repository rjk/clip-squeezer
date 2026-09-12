mod common;
use common::find_test_binary;
use std::fs;
use std::path::PathBuf;
use clip_squeezer_lib::media::planner::{build_ffmpeg_args, plan_audio_extraction, ExtractAudioMode, ExtractAudioRequest};
use clip_squeezer_lib::media::probe::probe_media_file;

#[test]
fn test_extract_audio_end_to_end() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let fixture_path = manifest_dir.parent().unwrap().join("tests").join("fixtures").join("test_1080p.mp4");
    let ffprobe_bin = find_test_binary("ffprobe");
    let ffmpeg_bin = find_test_binary("ffmpeg");

    assert!(fixture_path.exists());
    let probe = probe_media_file(&ffprobe_bin, &fixture_path).expect("Probe fixture");

    // 1. Extract MP3
    let mp3_req = ExtractAudioRequest { mode: ExtractAudioMode::Mp3 };
    let mp3_plan = plan_audio_extraction(&probe, &mp3_req).expect("Plan MP3 extraction");
    assert_eq!(mp3_plan.video_strategy, clip_squeezer_lib::media::planner::VideoStrategy::Omit);

    let mp3_args = build_ffmpeg_args(&mp3_plan);
    let mp3_out = std::process::Command::new(&ffmpeg_bin)
        .args(&mp3_args)
        .output()
        .expect("Run ffmpeg MP3");
    assert!(mp3_out.status.success(), "MP3 extraction failed: {:?}", String::from_utf8_lossy(&mp3_out.stderr));
    assert!(mp3_plan.output_path.exists());

    let mp3_probe = probe_media_file(&ffprobe_bin, &mp3_plan.output_path).expect("Probe MP3");
    assert!(!mp3_probe.has_video, "Extracted audio must not have video stream");
    assert!(mp3_probe.has_audio);
    assert_eq!(mp3_probe.audio_streams[0].codec, "mp3");
    let _ = fs::remove_file(mp3_plan.output_path);

    // 2. Extract Original (AAC -> M4A stream copy)
    let orig_req = ExtractAudioRequest { mode: ExtractAudioMode::OriginalQuality };
    let orig_plan = plan_audio_extraction(&probe, &orig_req).expect("Plan Original extraction");
    assert!(orig_plan.is_remux);

    let orig_args = build_ffmpeg_args(&orig_plan);
    let orig_out = std::process::Command::new(&ffmpeg_bin)
        .args(&orig_args)
        .output()
        .expect("Run ffmpeg Original");
    assert!(orig_out.status.success());
    assert!(orig_plan.output_path.exists());

    let orig_probe = probe_media_file(&ffprobe_bin, &orig_plan.output_path).expect("Probe M4A");
    assert!(!orig_probe.has_video);
    assert_eq!(orig_probe.audio_streams[0].codec, "aac");
    let _ = fs::remove_file(orig_plan.output_path);
}
