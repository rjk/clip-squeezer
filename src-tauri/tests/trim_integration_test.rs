use std::fs;
use std::path::PathBuf;
use clip_squeezer_lib::media::planner::{build_ffmpeg_args, plan_trim, TrimRequest};
use clip_squeezer_lib::media::probe::probe_media_file;

#[test]
fn test_trim_end_to_end() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let fixture_path = manifest_dir.parent().unwrap().join("tests").join("fixtures").join("test_1080p.mp4");
    let ffprobe_bin = manifest_dir.join("binaries").join("ffprobe-x86_64-pc-windows-msvc.exe");
    let ffmpeg_bin = manifest_dir.join("binaries").join("ffmpeg-x86_64-pc-windows-msvc.exe");

    assert!(fixture_path.exists());
    let probe = probe_media_file(&ffprobe_bin, &fixture_path).expect("Probe fixture");

    // Trim from 1.0s to 3.5s (duration 2.5s)
    let trim_req = TrimRequest {
        start_seconds: 1.0,
        end_seconds: 3.5,
    };

    let plan = plan_trim(&probe, &trim_req).expect("Plan trim");
    assert_eq!(plan.seek_start, Some(1.0));
    assert_eq!(plan.duration_limit, Some(2.5));
    assert_eq!(plan.expected_duration, 2.5);

    let args = build_ffmpeg_args(&plan);
    let out = std::process::Command::new(&ffmpeg_bin)
        .args(&args)
        .output()
        .expect("Run ffmpeg trim");

    assert!(out.status.success(), "Trim execution failed: {:?}", String::from_utf8_lossy(&out.stderr));
    assert!(plan.output_path.exists());

    let result_probe = probe_media_file(&ffprobe_bin, &plan.output_path).expect("Probe trimmed file");
    assert!(result_probe.has_video);
    assert!(result_probe.has_audio);

    // Verify duration is within 0.2s tolerance of 2.5s
    let diff = (result_probe.duration_seconds - 2.5).abs();
    assert!(diff < 0.2, "Trim duration difference too high: {} (expected ~2.5s)", result_probe.duration_seconds);

    // Clean up
    let _ = fs::remove_file(plan.output_path);
}
