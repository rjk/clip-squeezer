# ADR 0002: Two-Stage Planner Architecture

## Status
Accepted

## Context
A major anti-pattern in media utilities is allowing UI widgets to directly assemble command-line flags (e.g. checkbox -> `-c:v libx264`). This couples UI components to FFmpeg command syntax, makes unit testing impossible without spawning child processes, and prevents intelligent decision making (such as choosing stream-copy vs transcode based on probed stream properties).

## Decision
We decouple user intent from execution using a two-stage architecture:
1. **User Request -> MediaPlan**: A pure domain planner function (e.g. `plan_compression(probe, req) -> Result<MediaPlan, MediaError>`) inspects the input `MediaInfo` and user intent to produce a concrete, codec-independent `MediaPlan`.
2. **MediaPlan -> FFmpeg Arguments**: An argument builder translates the validated `MediaPlan` into an array of command arguments.

## Consequences
- **Positive**: 100% of domain planning logic can be unit-tested without launching FFmpeg; the UI remains completely free of FFmpeg knowledge; future natural-language or automated triggers can target the safe `MediaPlan` layer without raw command injection.
- **Negative**: Adds an intermediate data structure between frontend requests and process invocation.
