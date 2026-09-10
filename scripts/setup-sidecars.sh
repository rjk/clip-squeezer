#!/usr/bin/env bash
set -euo pipefail

# Determine target triple
TARGET_TRIPLE="${1:-$(rustc -vV | sed -n 's|host: ||p')}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${SCRIPT_DIR}/../src-tauri/binaries"

mkdir -p "${BIN_DIR}"

FFMPEG_DEST="${BIN_DIR}/ffmpeg-${TARGET_TRIPLE}"
FFPROBE_DEST="${BIN_DIR}/ffprobe-${TARGET_TRIPLE}"

if [[ "${TARGET_TRIPLE}" =~ apple-darwin ]]; then
  if [[ "${TARGET_TRIPLE}" =~ aarch64 ]]; then
    ARCH="arm64"
  else
    ARCH="amd64"
  fi

  echo "Downloading static FFmpeg & FFprobe for macOS (${ARCH})..."
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "${TMP_DIR}"' EXIT

  curl -fSL "https://ffmpeg.martin-riedl.de/redirect/latest/macos/${ARCH}/release/ffmpeg.zip" -o "${TMP_DIR}/ffmpeg.zip"
  curl -fSL "https://ffmpeg.martin-riedl.de/redirect/latest/macos/${ARCH}/release/ffprobe.zip" -o "${TMP_DIR}/ffprobe.zip"

  unzip -q -o "${TMP_DIR}/ffmpeg.zip" -d "${TMP_DIR}/ffmpeg_out"
  unzip -q -o "${TMP_DIR}/ffprobe.zip" -d "${TMP_DIR}/ffprobe_out"

  FFMPEG_BIN="$(find "${TMP_DIR}/ffmpeg_out" -name ffmpeg -type f | head -n 1)"
  FFPROBE_BIN="$(find "${TMP_DIR}/ffprobe_out" -name ffprobe -type f | head -n 1)"

  if [[ -z "${FFMPEG_BIN}" || -z "${FFPROBE_BIN}" ]]; then
    echo "Error: Failed to find extracted ffmpeg or ffprobe binaries" >&2
    exit 1
  fi

  cp "${FFMPEG_BIN}" "${FFMPEG_DEST}"
  cp "${FFPROBE_BIN}" "${FFPROBE_DEST}"
  chmod +x "${FFMPEG_DEST}" "${FFPROBE_DEST}"
else
  # Fallback for Linux or other Unix environments
  FFMPEG_SRC="$(which ffmpeg || true)"
  FFPROBE_SRC="$(which ffprobe || true)"

  if [[ -z "${FFMPEG_SRC}" || -z "${FFPROBE_SRC}" ]]; then
    echo "Error: ffmpeg or ffprobe not found in PATH" >&2
    exit 1
  fi

  echo "Copying ${FFMPEG_SRC} -> ${FFMPEG_DEST}..."
  cp "${FFMPEG_SRC}" "${FFMPEG_DEST}"
  echo "Copying ${FFPROBE_SRC} -> ${FFPROBE_DEST}..."
  cp "${FFPROBE_SRC}" "${FFPROBE_DEST}"
  chmod +x "${FFMPEG_DEST}" "${FFPROBE_DEST}"
fi

echo "Sidecars installed successfully:"
echo " - $(ls -lh "${FFMPEG_DEST}")"
echo " - $(ls -lh "${FFPROBE_DEST}")"

