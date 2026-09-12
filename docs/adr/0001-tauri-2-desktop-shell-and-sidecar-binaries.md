# ADR 0001: Tauri 2 Desktop Shell and Sidecar Binaries

## Status
Accepted

## Context
Simple Video Utility is a lightweight desktop utility for Windows and macOS. The core engine is FFmpeg/FFprobe. Ordinary users should never need to install FFmpeg, manage PATH variables, or use command-line package managers. Furthermore, security requirements dictate that untrusted file paths must never be interpolated into shell strings.

## Decision
1. We use **Tauri 2** as the desktop application framework with a React + TypeScript frontend and a Rust backend.
2. FFmpeg and FFprobe are bundled as **sidecar executables** with target-triple naming (e.g. `ffmpeg-x86_64-pc-windows-msvc.exe`) placed in `app/src-tauri/binaries/`.
3. The Rust backend invokes sidecars directly via argument vectors (`std::process::Command::new(binary_path).args(&[...])`) rather than delegating shell execution to the frontend or invoking shell interpreters (`cmd.exe` or `sh`).
4. Communication between frontend and backend is strictly via strongly-typed Tauri commands (e.g. `probe_media`, `start_compression`, `cancel_job`).

## Consequences
- **Positive**: Complete offline capability; zero installation friction for end users; total immunity against shell injection attacks via malicious filenames; direct control over process handles for real-time progress and clean cancellation.
- **Negative**: Binary package size increases due to bundled FFmpeg executables; platform-specific sidecars must be acquired and pinned for each build target.
