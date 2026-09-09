use std::fs;
use std::io;
use std::path::Path;
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Manager};

/// Purges files directly inside dir whose last modified time is older than max_age.
/// Subdirectories and non-files are skipped.
pub fn purge_dir_files_older_than(dir: &Path, max_age: Duration) -> io::Result<usize> {
    if !dir.exists() || !dir.is_dir() {
        return Ok(0);
    }

    let mut purged_count = 0;
    let now = SystemTime::now();

    for entry in fs::read_dir(dir)? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        if path.is_file() {
            if let Ok(metadata) = fs::metadata(&path) {
                if let Ok(modified) = metadata.modified() {
                    if let Ok(elapsed) = now.duration_since(modified) {
                        if elapsed >= max_age {
                            if fs::remove_file(&path).is_ok() {
                                purged_count += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(purged_count)
}

/// Purges orphaned preview proxies and temp artifacts older than 1 hour from the application cache.
pub fn purge_app_cache_on_startup(app: &AppHandle) {
    if let Ok(cache_dir) = app.path().app_cache_dir() {
        let proxy_dir = cache_dir.join("proxies");
        let one_hour = Duration::from_secs(3600);
        let _ = purge_dir_files_older_than(&proxy_dir, one_hour);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    #[test]
    fn test_purge_dir_files_older_than() {
        let temp_dir = std::env::temp_dir().join(format!(
            "test_purge_{}",
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&temp_dir).unwrap();

        let old_file = temp_dir.join("old.tmp");
        let new_file = temp_dir.join("new.tmp");

        {
            let mut f1 = File::create(&old_file).unwrap();
            writeln!(f1, "old data").unwrap();
            let mut f2 = File::create(&new_file).unwrap();
            writeln!(f2, "new data").unwrap();
        }

        std::thread::sleep(Duration::from_millis(60));

        let purged = purge_dir_files_older_than(&temp_dir, Duration::from_millis(40)).unwrap();
        assert_eq!(purged, 2);
        assert!(!old_file.exists());
        assert!(!new_file.exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_purge_keeps_fresh_files() {
        let temp_dir = std::env::temp_dir().join(format!(
            "test_purge_fresh_{}",
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&temp_dir).unwrap();

        let fresh_file = temp_dir.join("fresh.tmp");
        {
            let mut f = File::create(&fresh_file).unwrap();
            writeln!(f, "fresh data").unwrap();
        }

        let purged = purge_dir_files_older_than(&temp_dir, Duration::from_secs(3600)).unwrap();
        assert_eq!(purged, 0);
        assert!(fresh_file.exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
