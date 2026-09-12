use std::fs::{self, OpenOptions};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Checks whether a new output file can be created next to a source media
/// file, without leaving a file behind.
pub fn can_write_to_source_directory(source_path: &Path) -> bool {
    let Some(parent) = source_path.parent() else {
        return false;
    };

    let probe_name = format!(
        ".clip-squeezer-write-check-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    let probe_path = parent.join(probe_name);

    match OpenOptions::new().write(true).create_new(true).open(&probe_path) {
        Ok(_) => fs::remove_file(probe_path).is_ok(),
        Err(_) => false,
    }
}

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

/// Resolve a collision-safe output path using a complete filename in the
/// source file's directory.
pub fn resolve_collision_safe_named_path(source_path: &Path, filename: &str) -> PathBuf {
    let parent = source_path.parent().unwrap_or_else(|| Path::new(""));
    let filename_path = Path::new(filename);
    let mut candidate = parent.join(filename_path);

    if !candidate.exists() {
        return candidate;
    }

    let stem = filename_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("output");
    let extension = filename_path
        .extension()
        .and_then(|extension| extension.to_str())
        .filter(|extension| !extension.is_empty());

    let mut counter = 2;
    loop {
        let numbered_filename = match extension {
            Some(extension) => format!("{stem}-{counter}.{extension}"),
            None => format!("{stem}-{counter}"),
        };
        candidate = parent.join(numbered_filename);
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

    #[test]
    fn detects_when_a_source_directory_accepts_a_new_output_file() {
        let directory = std::env::temp_dir().join(format!(
            "clip-squeezer-write-check-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&directory).unwrap();
        let source = directory.join("input.mp4");

        assert!(can_write_to_source_directory(&source));

        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn adds_a_suffix_to_an_existing_named_output() {
        let directory = std::env::temp_dir().join(format!(
            "clip-squeezer-named-output-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&directory).unwrap();
        let source = directory.join("input.mp4");
        fs::write(directory.join("input-smaller.mp4"), "existing output").unwrap();

        let output = resolve_collision_safe_named_path(&source, "input-smaller.mp4");

        assert_eq!(output, directory.join("input-smaller-2.mp4"));
        fs::remove_dir_all(directory).unwrap();
    }
}
