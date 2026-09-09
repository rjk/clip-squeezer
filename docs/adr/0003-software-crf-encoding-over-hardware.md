# ADR 0003: Software CRF Encoding Over Hardware Encoders in v1

## Status
Accepted

## Context
Hardware-accelerated encoders (NVENC, Intel Quick Sync, Apple VideoToolbox, AMD AMF) differ wildly across host machines in availability, rate-control semantics, quality-to-bitrate curves, and parameter flags. Building hardware detection and custom profiles for each vendor introduces significant non-deterministic failure modes during initial releases.

## Decision
For v1, we standardize exclusively on software encoders (`libx264`, `libx265`, `libvpx-vp9`, `aac`, `libmp3lame`, `libopus`) utilizing Constant Rate Factor (CRF) quality presets. Hardware acceleration is intentionally deferred post-v1.

## Consequences
- **Positive**: Fully deterministic, reproducible compression behavior across all Windows and macOS environments; zero driver or vendor compatibility issues; consistent visual quality.
- **Negative**: Encoding large 4K files takes longer compared to dedicated GPU encoders; user machines experience higher CPU utilization during processing.
