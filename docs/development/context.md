# Domain Model: Simple Video Utility

This glossary defines the canonical domain vocabulary for Simple Video Utility. All code, types, commands, and tests must adhere to these terms.

## Core Concepts

### Media File
A local digital video or audio asset selected by the user. The utility operates strictly on local media files and never uploads or modifies the original source file.

### MediaInfo
The structured, typed inspection result produced by probing a media file.
- **`path`**: Absolute path to the source media file.
- **`filename`**: Basename of the file (e.g. `holiday-video.mov`).
- **`size_bytes`**: Physical file size in bytes.
- **`duration_seconds`**: Total duration of the container/stream in seconds.
- **`container`**: Format name of the container (e.g. `mov`, `mp4`, `matroska`).
- **`video_streams`**: Probed video streams containing dimensions, codec, frame rate, pixel format, and rotation.
- **`audio_streams`**: Probed audio streams containing codec, sample rate, channels, and channel layout.

### Derived Labels
User-facing formatting of technical properties into human language:
- **Duration**: `3 min 42 sec`, `45 sec`, `1 hr 12 min`.
- **Resolution**: `4K`, `1080p`, `720p`, `480p`, or custom dimensions if non-standard.
- **File Size**: `1.8 GB`, `412 MB`, `850 KB`.

---

## User Requests

High-level domain objects representing user intent without low-level FFmpeg flags or codec jargon.

### CompressRequest (Make smaller)
- **`quality`**: User intent for quality vs file size: `BestQuality`, `Balanced` (default), `SmallestFile`.
- **`resolution`**: Target resolution limit: `KeepOriginal` (default), `P1080`, `P720`. Never upscales.
- **`compatibility`**: Compatibility target: `Wide` (works almost everywhere, H.264), `SmallerFile` (HEVC/H.265).

### ConvertRequest (Convert)
- **`format`**: Desired container format: `Mp4` (recommended), `Mov`, `Mkv`, `Webm`.

### ExtractAudioRequest (Extract audio)
- **`mode`**: Desired audio output: `OriginalQuality` (stream-copy if practical), `Mp3` (works everywhere), `M4a` (good quality, smaller).

### TrimRequest (Trim)
- **`start_seconds`**: Start offset in seconds (e.g. `12.5`).
- **`end_seconds`**: End offset in seconds (e.g. `214.0`). Must be strictly greater than `start_seconds` and within source duration.

---

## Internal Planning

### MediaPlan
The concrete execution recipe created by a domain planner. Completely isolates the UI from FFmpeg command construction.
- **`input_path`**: Path to input media.
- **`output_path`**: Resolved collision-safe target path.
- **`video_strategy`**: One of `Copy`, `Transcode(VideoProfile)`, `Omit`.
- **`audio_strategy`**: One of `Copy`, `Transcode(AudioProfile)`, `Omit`.
- **`filters`**: Video or audio filter chains (e.g. scaling `scale=-2:min(1080\,ih)`).
- **`faststart`**: Whether `-movflags +faststart` should be applied (for MP4).
- **`expected_duration`**: Duration expected for the output file (used for accurate progress tracking).
- **`is_remux`**: Flag indicating if video and audio are stream-copied without re-encoding.

### VideoProfile
Encoder profile configuration (e.g., `H264Balanced`, `H264BestQuality`, `H265Balanced`, `Vp9Standard`).

### AudioProfile
Audio encoder configuration (e.g., `AacStandard`, `Mp3Standard`, `OpusStandard`).

---

## Execution & Lifecycle

### Job
The stateful execution of a single planned operation.
- **`id`**: Unique identifier for tracking and cancellation.
- **`operation`**: Name of the action (`Compress`, `Convert`, `ExtractAudio`, `Trim`).
- **`state`**: Lifecycle state of the job.
- **`progress`**: Progress information derived from FFmpeg's `-progress pipe:1`.
- **`output_path`**: Destination file path.

### JobState
- **`Queued`**: Job created, waiting to spawn.
- **`Running`**: Process spawned and running.
- **`Completed`**: FFmpeg finished with code 0 and output verified.
- **`Failed`**: Process exited non-zero or output failed validation.
- **`Cancelled`**: Process killed by user action; partial output cleaned up.

### ProgressUpdate
Real-time progress reporting:
- **`percent`**: Normalized progress from `0.0` to `100.0`.
- **`out_time_seconds`**: Processed timestamp in seconds.
- **`speed`**: Encoding speed multiplier if reported.

---

## Errors

### MediaError
Domain-specific error representations mapped to user-friendly messages:
- **`FileNotFound`**: Specified file does not exist.
- **`InvalidMedia`**: File cannot be probed or parsed by FFprobe.
- **`NoVideoStream`**: Operation requires video, but file has none.
- **`NoAudioStream`**: Operation requires audio, but file has none.
- **`InvalidTrimBounds`**: Start is after end, or bounds are out of range.
- **`InsufficientSpace`**: Target drive lacks disk space.
- **`ProcessFailed`**: FFmpeg process returned a non-zero exit code. Contains raw stderr for technical diagnostics.
- **`Cancelled`**: User initiated cancellation.
- **`OutputValidationFailed`**: FFmpeg returned 0 but output file is missing or 0 bytes.
