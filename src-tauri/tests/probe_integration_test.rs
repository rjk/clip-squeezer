mod common;
use common::find_test_binary;
use std::path::PathBuf;
use clip_squeezer_lib::media::probe::probe_media_file;

#[test]
fn test_probe_real_mp4_fixture() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let fixture_path = manifest_dir.parent().unwrap().join("tests").join("fixtures").join("test_1080p.mp4");
    
    // Check sidecar binary
    let ffprobe_bin = find_test_binary("ffprobe");
    assert!(ffprobe_bin.exists(), "ffprobe binary must exist at {:?}", ffprobe_bin);
    assert!(fixture_path.exists(), "fixture must exist at {:?}", fixture_path);

    let info = probe_media_file(&ffprobe_bin, &fixture_path).expect("Probing fixture should succeed");

    assert_eq!(info.filename, "test_1080p.mp4");
    assert!(info.has_video);
    assert!(info.has_audio);
    assert_eq!(info.friendly_resolution, "1080p");
    assert_eq!(info.friendly_duration, "5 sec");
    assert_eq!(info.video_streams[0].width, 1920);
    assert_eq!(info.video_streams[0].height, 1080);
    assert_eq!(info.video_streams[0].codec, "h264");
    assert_eq!(info.audio_streams[0].codec, "aac");
}
