# Clip Squeezer

![Clip Squeezer — Four useful things. One small app.](branding/social/repository-banner.png)

A fast, private, and simple desktop utility for common video tasks. Squeeze your videos down to size: no timelines, no codec jargon, no subscriptions, and zero cloud uploads. Everything runs 100% locally on your machine.

---

## What It Does

Most people don't need a heavy multi-track video editor when they just want to send a clip to a colleague or trim a meeting recording. Clip Squeezer gives you 4 straightforward actions:

1. **Make smaller**: Compress videos to share via Slack, Discord, email, or messaging apps. Choose simple presets like *Best quality*, *Balanced*, or *Smallest file*.
2. **Convert**: Turn tricky formats (like .mkv or .webm) into standard .mp4 or .mov files. Remuxes instantly whenever possible without losing any quality.
3. **Trim**: Cut out the beginning or end of a clip with a visual timeline preview and exact time inputs.
4. **Extract audio**: Save the soundtrack or voice recording as a high-quality .mp3 or .m4a file.

### Guiding Principles

- **Zero jargon**: No bitrate calculations, keyframe intervals, or container matrices shown to the user.
- **Never modifies your original file**: All operations write to a new, collision-safe file (e.g. `video (compressed).mp4`).
- **Completely offline**: No analytics, telemetry, or remote server dependencies. Your files never leave your computer.
- **Cancel anytime**: Long processes can be cancelled with one click, cleanly terminating background tasks and cleaning up partial files.

---

## Branding

[Browse the brand kit](branding/index.html) · [Usage guide and asset downloads](branding/README.md)

Logo variants, 27 interface icons, desktop app icons, social cards and release artwork share one visual identity.

## Architecture

Clip Squeezer is built with:
- **Tauri 2**: Lightweight native desktop shell with low memory footprint.
- **React 19 + TypeScript**: Minimal, responsive UI with a custom vector icon family.
- **Bundled FFmpeg & FFprobe**: Embedded sidecar binaries for cross-platform media processing.
- **Two-Stage Planner**: Strict Rust domain engine separating plan generation from execution.

---

## Development Setup

### Prerequisites

- **Node.js**: v18 or later
- **Rust**: 1.80+ (MSVC toolchain on Windows)
- **FFmpeg 7.0+**: Installed on your system (e.g., via `choco install ffmpeg` or `brew install ffmpeg`)

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/rjk/clip-squeezer.git
cd clip-squeezer

# Install web dependencies
npm install
```

### 2. Set Up Sidecar Binaries

The application bundles `ffmpeg` and `ffprobe` as Tauri sidecars. Run the setup script to copy them into the proper sidecar path:

**Windows (PowerShell):**
```powershell
.\scripts\setup-sidecars.ps1
```

### 3. Run Development Server

```bash
npm run tauri dev
```

### 4. Running Tests

```bash
# Frontend build & typecheck
npm run build

# Rust unit and integration tests
cargo test --manifest-path src-tauri/Cargo.toml
```

### 5. Packaging for Distribution

```bash
npm run tauri build
```

The resulting installer (.msi / .exe / .dmg / .deb) will be located in src-tauri/target/release/bundle/.

For automated multi-platform releases (Windows & macOS) via GitHub Actions, see [Release Guide](docs/RELEASING.md).


---

## Licensing

- Application source code is dual-licensed under [MIT](LICENSE-MIT) and [Apache 2.0](LICENSE-APACHE).
- Bundled FFmpeg binaries are licensed under the GNU General Public License (GPL) v3. See [THIRD_PARTY_LICENSES/ffmpeg.txt](THIRD_PARTY_LICENSES/ffmpeg.txt) for details.
