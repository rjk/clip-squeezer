# Release and Publishing Guide

This document outlines the workflow for syncing changes to the public GitHub repository as clean, squashed release commits without leaking private Git history, and publishing automated Windows & macOS installers.

---

## Repository Setup & Model

You have two git remotes:
- **`origin`**: Your private repository (`rjk/clip-squeezer-private.git`), where all your work, incremental commits, experiments, and history live on `main`.
- **`public`**: Your public open-source repository (`rjk/clip-squeezer.git`), which only receives curated, squashed release commits on its `main` branch.

To keep these distinct, you have a local branch called `public-main` that tracks `public/main`.

---

## The Standard Release Workflow

Whenever you are ready to ship a new version (e.g. `v0.1.0` or `v0.2.0`), run the following steps:

### 1. In your local `main` branch
Make sure everything you want to release is committed on `main`:
```bash
git checkout main
git status
```

### 2. Switch to `public-main` and pull latest
```bash
git checkout public-main
git pull public main
```

### 3. Bring over all changes from `main` without importing commit history
To update the public working tree to match `main` exactly in one step:
```bash
git restore --source=main --staged --worktree .
```

*(Optional: check `git status` or `git diff --staged` to verify the staged files)*

### 4. Commit the single release commit
```bash
git commit -m "feat: release v0.1.0"
```

### 5. Create or move the version tag to this commit
```bash
git tag -f -a v0.1.0 -m "Release v0.1.0"
```

### 6. Push `public-main` and the tag to the public repo
```bash
git push public public-main:main
git push public v0.1.0 --force
```

---

## What Happens Automatically Next

1. GitHub Actions detects the `v*` tag and runs [`.github/workflows/release.yml`](../.github/workflows/release.yml).
2. Three build runners execute in parallel:
   - **Windows** (`x86_64-pc-windows-msvc`) $\rightarrow$ `.exe` / `.msi` installers
   - **macOS Apple Silicon** (`aarch64-apple-darwin`) $\rightarrow$ `.dmg` (M1/M2/M3/M4)
   - **macOS Intel** (`x86_64-apple-darwin`) $\rightarrow$ `.dmg`
3. Each runner installs dependencies, downloads FFmpeg/FFprobe sidecars, builds the app bundle, and publishes the files to:
   👉 **[https://github.com/rjk/clip-squeezer/releases](https://github.com/rjk/clip-squeezer/releases)**

---

## Version Numbers Checklist (Before Releasing)

Before creating a new tag, verify that version numbers match across the project:
1. `package.json` (`"version": "0.1.0"`)
2. `src-tauri/tauri.conf.json` (`"version": "0.1.0"`)
3. `src-tauri/Cargo.toml` (`version = "0.1.0"`)
