mod common;
use common::find_test_binary;
use std::fs;
use std::path::PathBuf;
use clip_squeezer_lib::media::planner::{build_ffmpeg_args, plan_conversion, ConvertFormat, ConvertRequest};
use clip_squeezer_lib::media::probe::probe_media_file;

#[test]
fn test_convert_remux_and_transcode_end_to_end() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let fixture_path = manifest_dir.parent().unwrap().join("tests").join("fixtures").join("test_1080p.mp4");
    let ffprobe_bin = find_test_binary("ffprobe");
    let ffmpeg_bin = find_test_binary("ffmpeg");

    assert!(fixture_path.exists());
    let probe = probe_media_file(&ffprobe_bin, &fixture_path).expect("Probe fixture");

    // 1. Remux MP4 -> MKV (both h264 and aac copy directly into MKV)
    let mkv_req = ConvertRequest { format: ConvertFormat::Mkv, allow_large_gif: false };
    let mkv_plan = plan_conversion(&probe, &mkv_req).expect("Plan MP4->MKV");
    assert!(mkv_plan.is_remux, "MP4 -> MKV should be remux/stream-copy");

    let mkv_args = build_ffmpeg_args(&mkv_plan);
    let mkv_out = std::process::Command::new(&ffmpeg_bin)
        .args(&mkv_args)
        .output()
        .expect("Run ffmpeg MP4->MKV");
    assert!(mkv_out.status.success(), "MKV remux failed: {:?}", String::from_utf8_lossy(&mkv_out.stderr));
    assert!(mkv_plan.output_path.exists());

    let mkv_probe = probe_media_file(&ffprobe_bin, &mkv_plan.output_path).expect("Probe MKV");
    assert_eq!(mkv_probe.video_streams[0].codec, "h264");
    assert_eq!(mkv_probe.audio_streams[0].codec, "aac");
    let _ = fs::remove_file(mkv_plan.output_path);

    // 2. Transcode MP4 -> WebM (VP9 + Opus)
    let webm_req = ConvertRequest { format: ConvertFormat::Webm, allow_large_gif: false };
    let webm_plan = plan_conversion(&probe, &webm_req).expect("Plan MP4->WebM");
    assert!(!webm_plan.is_remux, "MP4 -> WebM requires transcode");

    let webm_args = build_ffmpeg_args(&webm_plan);
    let webm_out = std::process::Command::new(&ffmpeg_bin)
        .args(&webm_args)
        .output()
        .expect("Run ffmpeg MP4->WebM");
    assert!(webm_out.status.success(), "WebM transcode failed: {:?}", String::from_utf8_lossy(&webm_out.stderr));
    assert!(webm_plan.output_path.exists());

    let webm_probe = probe_media_file(&ffprobe_bin, &webm_plan.output_path).expect("Probe WebM");
    assert_eq!(webm_probe.video_streams[0].codec, "vp9");
    assert_eq!(webm_probe.audio_streams[0].codec, "opus");
    let _ = fs::remove_file(webm_plan.output_path);
}
