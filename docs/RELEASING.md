# Release Guide

This document explains how to publish a new release of **Clip Squeezer** with automated Windows and macOS installer downloads via GitHub Actions.

---

## Architecture Overview

Clip Squeezer uses GitHub Actions ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) to build and release across multiple operating systems in parallel:

| Matrix Runner | Target Architecture | Artifact Generated |
| :--- | :--- | :--- |
| `windows-latest` | `x86_64-pc-windows-msvc` | Windows `.exe` / `.msi` installers |
| `macos-latest` | `aarch64-apple-darwin` | Apple Silicon `.dmg` installer (M1/M2/M3/M4) |
| `macos-13` | `x86_64-apple-darwin` | Intel Mac `.dmg` installer |

Each runner downloads the matching static FFmpeg/FFprobe binaries into `src-tauri/binaries/` and uses `tauri-apps/tauri-action` to build native bundles and attach them directly to GitHub Releases.

---

## Publishing a Release

### 1. Update Version Numbers (When Releasing)
Ensure the version matches in:
- `package.json` (`"version": "0.1.0"`)
- `src-tauri/tauri.conf.json` (`"version": "0.1.0"`)
- `src-tauri/Cargo.toml` (`version = "0.1.0"`)

### 2. Commit and Push
```bash
git commit -am "chore: bump version to 0.1.0"
git push origin main
```

### 3. Create and Push a Version Tag
Creating and pushing any `v*` tag triggers the build and release workflow automatically:
```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

*(If you ever need to move an existing tag to the latest commit: `git tag -f -a v0.1.0 -m "Release v0.1.0"` followed by `git push origin v0.1.0 --force`)*

---

## Where to Find Your Downloads

Once the workflow finishes (~5–10 minutes):
1. **Releases Page**: [https://github.com/rjk/clip-squeezer/releases](https://github.com/rjk/clip-squeezer/releases)
2. **Latest Release Permalink**: [https://github.com/rjk/clip-squeezer/releases/latest](https://github.com/rjk/clip-squeezer/releases/latest)

The release will contain:
- `Clip Squeezer_0.1.0_x64-setup.exe` (Windows installer)
- `Clip Squeezer_0.1.0_aarch64.dmg` (macOS Apple Silicon)
- `Clip Squeezer_0.1.0_x64.dmg` (macOS Intel)

---

## Keeping Commit History Clean / Squashing (Optional)

If you made several small WIP commits locally and want to condense them into one clean commit before pushing:

```bash
# Squash the last N commits into one (e.g. last 3 commits)
git reset --soft HEAD~3
git commit -m "feat: description of changes"
git push origin main
```
