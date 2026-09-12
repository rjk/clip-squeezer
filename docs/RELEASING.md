# Release Guide

This document explains how to publish a new release of **Clip Squeezer** with automated Windows and macOS installer downloads via GitHub Actions.

---

## Architecture Overview

Clip Squeezer uses GitHub Actions ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) to build and release across multiple operating systems in parallel:

| Matrix Runner | Target Architecture | Artifact Generated |
| :--- | :--- | :--- |
| `windows-latest` | `x86_64-pc-windows-msvc` | Windows `.exe` / `.msi` installers |
| `macos-latest` | `aarch64-apple-darwin` | Apple Silicon `.dmg` installer (M1/M2/M3/M4) |
| `macos-15-intel` | `x86_64-apple-darwin` | Intel Mac `.dmg` installer |

Each runner downloads the matching static FFmpeg/FFprobe binaries into `app/src-tauri/binaries/` and uses `tauri-apps/tauri-action` to build native bundles and attach them directly to GitHub Releases.

---

## Publishing a Release

### Automated Release (Recommended)

Run the release script from the application directory:

```bash
cd app

# Interactive mode (prompts for patch, minor, major, or custom version)
npm run release

# Or specify the bump type directly
npm run release -- patch
npm run release -- minor
npm run release -- 0.3.0

# Optional flags:
npm run release -- --dry-run   # Test version bump, lockfile updates, and build without pushing
npm run release -- -y           # Skip confirmation prompt
```

The script automatically:
1. Validates a clean git working tree on `main`.
2. Bumps version in `app/package.json`, `app/src-tauri/tauri.conf.json`, and `app/src-tauri/Cargo.toml`.
3. Synchronizes `package-lock.json` and `Cargo.lock`.
4. Runs verification build (`npm run build`).
5. Commits changes (`chore: bump version to X.Y.Z`).
6. Pushes commit to `origin main`.
7. Creates and pushes the matching `vX.Y.Z` git tag to trigger the GitHub Actions release workflow.

---

### Manual Release Steps (Reference)

If you prefer to perform the steps manually:

#### 1. Update Version Numbers
Ensure the version matches in:
- `app/package.json` (`"version": "X.Y.Z"`)
- `app/src-tauri/tauri.conf.json` (`"version": "X.Y.Z"`)
- `app/src-tauri/Cargo.toml` (`version = "X.Y.Z"`)
- From `app/`, run `npm install --package-lock-only`, then run `cargo check --manifest-path src-tauri/Cargo.toml` to update lockfiles.

#### 2. Commit and Push
```bash
git commit -am "chore: bump version to X.Y.Z"
git push origin main
```

#### 3. Create and Push a Version Tag
```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

---

## Where to Find Your Downloads

Once the workflow finishes (~5–10 minutes):
1. **Releases Page**: [https://github.com/rjk/clip-squeezer/releases](https://github.com/rjk/clip-squeezer/releases)
2. **Latest Release Permalink**: [https://github.com/rjk/clip-squeezer/releases/latest](https://github.com/rjk/clip-squeezer/releases/latest)

The release will contain:
- `ClipSqueezer_0.1.0_x64-setup.exe` (Windows installer)
- `ClipSqueezer_0.1.0_aarch64.dmg` (macOS Apple Silicon)
- `ClipSqueezer_0.1.0_x64.dmg` (macOS Intel)

---

## Keeping Commit History Clean / Squashing (Optional)

If you made several small WIP commits locally and want to condense them into one clean commit before pushing:

```bash
# Squash the last N commits into one (e.g. last 3 commits)
git reset --soft HEAD~3
git commit -m "feat: description of changes"
git push origin main
```
