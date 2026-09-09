use std::fs;
use std::path::PathBuf;
use clip_squeezer_lib::media::planner::{plan_compression, CompressCompatibility, CompressQuality, CompressRequest, CompressResolution};
use clip_squeezer_lib::media::probe::probe_media_file;

#[test]
fn test_compression_end_to_end_on_fixture() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let fixture_path = manifest_dir.parent().unwrap().join("tests").join("fixtures").join("test_1080p.mp4");
    let ffprobe_bin = manifest_dir.join("binaries").join("ffprobe-x86_64-pc-windows-msvc.exe");
    let ffmpeg_bin = manifest_dir.join("binaries").join("ffmpeg-x86_64-pc-windows-msvc.exe");

    assert!(fixture_path.exists());
    assert!(ffprobe_bin.exists());
    assert!(ffmpeg_bin.exists());

    let probe = probe_media_file(&ffprobe_bin, &fixture_path).expect("Probe fixture");
    let initial_source_len = fs::metadata(&fixture_path).unwrap().len();

    let req = CompressRequest {
        quality: CompressQuality::Balanced,
        resolution: CompressResolution::P720,
        compatibility: CompressCompatibility::Wide,
    };

    let plan = plan_compression(&probe, &req).expect("Plan compression");
    assert_eq!(plan.video_filter, Some("scale=-2:720".to_string()));

    // Execute ffmpeg directly with args
    let args = clip_squeezer_lib::media::planner::build_ffmpeg_args(&plan);
    let output = std::process::Command::new(&ffmpeg_bin)
        .args(&args)
        .output()
        .expect("FFmpeg execution");

    assert!(output.status.success(), "FFmpeg failed: {:?}", String::from_utf8_lossy(&output.stderr));
    assert!(plan.output_path.exists(), "Output file must exist at {:?}", plan.output_path);

    // Verify resulting file with ffprobe
    let result_probe = probe_media_file(&ffprobe_bin, &plan.output_path).expect("Probe compressed file");
    assert_eq!(result_probe.friendly_resolution, "720p");
    assert_eq!(result_probe.video_streams[0].codec, "h264");
    assert!(result_probe.has_audio);

    // Verify source was NEVER modified
    let after_source_len = fs::metadata(&fixture_path).unwrap().len();
    assert_eq!(initial_source_len, after_source_len, "Source file must not be modified!");

    // Clean up test output
    let _ = fs::remove_file(plan.output_path);
}
