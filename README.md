# Clip Squeezer

**Four simple video tools. Free. Fast. On your device.**

Make videos smaller, convert formats, trim the start or end, or extract the audio — without uploading your files or opening a full video editor.

Available for **Windows** and **macOS**. Free and open source.

> **Download Clip Squeezer:** [Latest release](https://github.com/rjk/clip-squeezer/releases/latest)

<!-- Add your main app screenshot or short demo GIF here -->

---

## Four simple tools

- **Compress** — Bring large video files down to size for Slack, Discord, email, or web sharing with simple quality presets: **Best quality**, **Balanced**, and **Smallest file**.
- **Convert** — Switch between MP4, MOV, MKV, and WebM without codec confusion.
- **Trim** — Keep only the part you need by choosing a start and end point with a visual preview.
- **Extract audio** — Save the sound or voice track as MP3 or M4A.

---

## Why Clip Squeezer?

- **100% local & private** — Everything is processed on your computer. Your media is never uploaded.
- **No telemetry or tracking** — No analytics, advertising, crash reporting, or background data collection.
- **Safe by default** — Your original video is never overwritten. Outputs are always saved as new files.
- **No bloat** — No timelines, complicated menus, or multi-track editing. Pick a tool, choose your file, and get your result.
- **Instant cancel** — Stop a running job with one click. Background processing stops and temporary files are cleaned up.
- **Open source** — The application and its build process can be inspected on GitHub.

---

## Privacy

Clip Squeezer processes media locally and does not transmit your files or usage information to external systems.

See the [Privacy Policy](PRIVACY.md) for details.

---

## Code signing policy

Official Windows releases are code signed to help users verify their origin and integrity.

**Free code signing provided by SignPath.io, certificate by SignPath Foundation.**

See the [Code signing policy](CODE_SIGNING_POLICY.md) for the release, approval, and signing process.

---

## Installing and uninstalling

Download the latest release from the [GitHub Releases page](https://github.com/rjk/clip-squeezer/releases/latest).

### Uninstalling

**Windows:** Open **Settings → Apps → Installed apps**, find **Clip Squeezer**, and choose **Uninstall**.

**macOS:** Quit Clip Squeezer and move the application from the **Applications** folder to the Trash.

---

## Documentation & project guides

- **[Development Setup](docs/DEVELOPMENT.md)** — Local prerequisites, building from source, running tests, and packaging.
- **[Architecture & Engine](docs/ARCHITECTURE.md)** — Details on the Tauri desktop shell, two-stage planner, and bundled FFmpeg sidecar runner.
- **[Branding & Design](docs/BRANDING.md)** — Brand assets, logo files, colour palette, and interface icon set.
- **[Release Process](docs/RELEASING.md)** — GitHub Actions build and release workflow.

---

## Licensing

- Application source code is dual-licensed under [MIT](LICENSE-MIT) and [Apache 2.0](LICENSE-APACHE).
- Bundled FFmpeg binaries are licensed under the GNU General Public License (GPL) v3. See [THIRD_PARTY_LICENSES/ffmpeg.txt](THIRD_PARTY_LICENSES/ffmpeg.txt) for details.