# Development Setup

### Prerequisites

- **Node.js**: v18 or later
- **Rust**: 1.80+ (MSVC toolchain on Windows)
- **FFmpeg 7.0+**: Installed on your system (e.g., via `choco install ffmpeg` or `brew install ffmpeg`)

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/rorykingan/clip-squeezer.git
cd clip-squeezer

# Install web dependencies
npm install
```

### 2. Set Up Sidecar Binaries

The application bundles ffmpeg and ffprobe as Tauri sidecars. Run the setup script to copy them into the proper sidecar path:

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

For automated multi-platform releases (Windows & macOS) via GitHub Actions, see [Release Guide](RELEASING.md).