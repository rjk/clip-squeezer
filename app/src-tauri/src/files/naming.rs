use std::path::{Path, PathBuf};

/// Generate a collision-safe output path in the same directory as the source.
/// E.g. "holiday.mov" with suffix "-smaller" and ext ".mp4" -> "holiday-smaller.mp4"
/// If "holiday-smaller.mp4" already exists, returns "holiday-smaller-2.mp4", etc.
pub fn resolve_collision_safe_path(source_path: &Path, suffix: &str, target_ext: &str) -> PathBuf {
    let parent = source_path.parent().unwrap_or_else(|| Path::new(""));
    let stem = source_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");

    let clean_ext = target_ext.trim_start_matches('.');
    let base_name = format!("{}{}.{}", stem, suffix, clean_ext);
    let mut candidate = parent.join(&base_name);

    if !candidate.exists() {
        return candidate;
    }

    let mut counter = 2;
    loop {
        let numbered_name = format!("{}-{}.{}", format!("{}{}", stem, suffix), counter, clean_ext);
        candidate = parent.join(&numbered_name);
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_new_path() {
        let source = PathBuf::from("C:\\fake_dir\\holiday.mov");
        let output = resolve_collision_safe_path(&source, "-smaller", "mp4");
        assert_eq!(output, PathBuf::from("C:\\fake_dir\\holiday-smaller.mp4"));
    }

    #[test]
    fn test_resolve_audio_ext() {
        let source = PathBuf::from("/videos/lecture.mp4");
        let output = resolve_collision_safe_path(&source, "-audio", ".mp3");
        assert_eq!(output, PathBuf::from("/videos/lecture-audio.mp3"));
    }
}
