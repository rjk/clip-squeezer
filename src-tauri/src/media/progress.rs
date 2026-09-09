use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProgressUpdate {
    pub percent: f64,
    pub out_time_seconds: f64,
    pub speed: Option<String>,
}

#[derive(Debug, Default)]
pub struct ProgressParser {
    out_time_us: Option<i64>,
    speed: Option<String>,
}

impl ProgressParser {
    pub fn new() -> Self {
        Self::default()
    }

    /// Process a line from ffmpeg -progress pipe:1.
    /// When progress=continue or progress=end is reached, returns a ProgressUpdate if data is available.
    pub fn parse_line(&mut self, line: &str, expected_duration: f64) -> Option<ProgressUpdate> {
        let trimmed = line.trim();
        if let Some((key, val)) = trimmed.split_once('=') {
            let key = key.trim();
            let val = val.trim();

            match key {
                "out_time_us" => {
                    if let Ok(us) = val.parse::<i64>() {
                        self.out_time_us = Some(us);
                    }
                }
                "out_time_ms" => {
                    if self.out_time_us.is_none() {
                        if let Ok(ms) = val.parse::<i64>() {
                            self.out_time_us = Some(ms); // Note: ffmpeg out_time_ms is often in microseconds historically
                        }
                    }
                }
                "speed" => {
                    if val != "N/A" && !val.is_empty() {
                        self.speed = Some(val.to_string());
                    }
                }
                "progress" => {
                    if let Some(us) = self.out_time_us {
                        let out_seconds = (us as f64) / 1_000_000.0;
                        let percent = if expected_duration > 0.0 {
                            ((out_seconds / expected_duration) * 100.0).clamp(0.0, 100.0)
                        } else {
                            0.0
                        };

                        return Some(ProgressUpdate {
                            percent,
                            out_time_seconds: out_seconds.max(0.0),
                            speed: self.speed.clone(),
                        });
                    }
                }
                _ => {}
            }
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_progress_lines() {
        let mut parser = ProgressParser::new();
        assert_eq!(parser.parse_line("frame=100", 10.0), None);
        assert_eq!(parser.parse_line("fps=30.0", 10.0), None);
        assert_eq!(parser.parse_line("out_time_us=5000000", 10.0), None);
        assert_eq!(parser.parse_line("speed=2.0x", 10.0), None);

        let update = parser.parse_line("progress=continue", 10.0).expect("Should produce update");
        assert_eq!(update.out_time_seconds, 5.0);
        assert_eq!(update.percent, 50.0);
        assert_eq!(update.speed, Some("2.0x".to_string()));
    }
}
