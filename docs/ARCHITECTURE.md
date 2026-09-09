# Architecture

Clip Squeezer is designed as a small, privacy-preserving desktop application that runs completely offline with no background analytics or cloud services.

## Technology Stack

- **Tauri 2**: Lightweight native desktop shell with low memory footprint.
- **React 19 + TypeScript**: Minimal, responsive UI with a custom vector icon family.
- **Bundled FFmpeg & FFprobe**: Embedded sidecar binaries for cross-platform media processing.
- **Two-Stage Planner**: Strict Rust domain engine separating plan generation from execution.

## System Design

1. **Two-Stage Execution**: Stage 1 generates an immutable execution plan resolving filenames and encoding flags; Stage 2 executes the plan via process runner monitoring and cancellation support.
2. **Local & Collision-Safe**: Never modifies the original file; automatically handles collision avoidance (e.g., video (compressed) (1).mp4).
3. **No Shell Interpolation**: All external binary invocations use explicit argument vectors to eliminate command injection risks.

For deeper context on technical decisions, see the Architecture Decision Records in [docs/adr/](adr/).