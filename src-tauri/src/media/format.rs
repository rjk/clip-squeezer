/// Pure formatting functions for derived human-friendly labels.

/// Format byte count into human-readable size (e.g. "1.8 GB", "412 MB", "850 KB").
pub fn format_bytes(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;

    let b = bytes as f64;
    if b >= GB {
        let val = b / GB;
        if val >= 10.0 {
            format!("{:.0} GB", val)
        } else {
            format!("{:.1} GB", val)
        }
    } else if b >= MB {
        let val = b / MB;
        if val >= 10.0 {
            format!("{:.0} MB", val)
        } else {
            format!("{:.1} MB", val)
        }
    } else if b >= KB {
        format!("{:.0} KB", b / KB)
    } else {
        format!("{} B", bytes)
    }
}

/// Format duration in seconds into human-friendly description (e.g. "3 min 42 sec", "45 sec", "1 hr 12 min").
pub fn format_duration(seconds: f64) -> String {
    if seconds <= 0.0 {
        return "0 sec".to_string();
    }

    let total_secs = seconds.round() as u64;
    let hours = total_secs / 3600;
    let minutes = (total_secs % 3600) / 60;
    let secs = total_secs % 60;

    if hours > 0 {
        if minutes > 0 {
            format!("{} hr {} min", hours, minutes)
        } else {
            format!("{} hr", hours)
        }
    } else if minutes > 0 {
        if secs > 0 {
            format!("{} min {} sec", minutes, secs)
        } else {
            format!("{} min", minutes)
        }
    } else {
        format!("{} sec", secs)
    }
}

/// Format video dimensions into user-friendly resolution label (e.g. "4K", "1080p", "720p", "480p").
/// Handles portrait and landscape video.
pub fn format_resolution(width: u32, height: u32) -> String {
    let (max_dim, min_dim) = if width >= height {
        (width, height)
    } else {
        (height, width)
    };

    // Standard video heights
    if (min_dim >= 2100 && min_dim <= 2200) || max_dim >= 3800 {
        "4K".to_string()
    } else if (min_dim >= 1400 && min_dim <= 1500) || (max_dim >= 2500 && max_dim <= 2600) {
        "1440p".to_string()
    } else if (min_dim >= 1050 && min_dim <= 1100) || (max_dim >= 1900 && max_dim <= 1950) {
        "1080p".to_string()
    } else if (min_dim >= 700 && min_dim <= 750) || (max_dim >= 1260 && max_dim <= 1300) {
        "720p".to_string()
    } else if min_dim >= 460 && min_dim <= 500 {
        "480p".to_string()
    } else if min_dim > 0 && max_dim > 0 {
        format!("{}x{}", width, height)
    } else {
        "Unknown".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(500), "500 B");
        assert_eq!(format_bytes(850 * 1024), "850 KB");
        assert_eq!(format_bytes(412 * 1024 * 1024), "412 MB");
        assert_eq!(format_bytes((1.8 * 1024.0 * 1024.0 * 1024.0) as u64), "1.8 GB");
        assert_eq!(format_bytes((12.4 * 1024.0 * 1024.0 * 1024.0) as u64), "12 GB");
    }

    #[test]
    fn test_format_duration() {
        assert_eq!(format_duration(0.0), "0 sec");
        assert_eq!(format_duration(45.2), "45 sec");
        assert_eq!(format_duration(222.0), "3 min 42 sec");
        assert_eq!(format_duration(180.0), "3 min");
        assert_eq!(format_duration(3600.0), "1 hr");
        assert_eq!(format_duration(4320.0), "1 hr 12 min");
    }

    #[test]
    fn test_format_resolution() {
        assert_eq!(format_resolution(3840, 2160), "4K");
        assert_eq!(format_resolution(2160, 3840), "4K"); // portrait 4K
        assert_eq!(format_resolution(1920, 1080), "1080p");
        assert_eq!(format_resolution(1080, 1920), "1080p"); // portrait 1080p
        assert_eq!(format_resolution(1280, 720), "720p");
        assert_eq!(format_resolution(854, 480), "480p");
        assert_eq!(format_resolution(640, 360), "640x360");
    }
}
