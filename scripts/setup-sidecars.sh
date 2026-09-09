#!/usr/bin/env bash
set -euo pipefail

# Determine target triple
TARGET_TRIPLE="${1:-$(rustc -vV | sed -n 's|host: ||p')}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${SCRIPT_DIR}/../src-tauri/binaries"

mkdir -p "${BIN_DIR}"

FFMPEG_SRC="$(which ffmpeg || true)"
FFPROBE_SRC="$(which ffprobe || true)"

if [[ -z "${FFMPEG_SRC}" || -z "${FFPROBE_SRC}" ]]; then
  echo "Error: ffmpeg or ffprobe not found in PATH" >&2
  exit 1
fi

FFMPEG_DEST="${BIN_DIR}/ffmpeg-${TARGET_TRIPLE}"
FFPROBE_DEST="${BIN_DIR}/ffprobe-${TARGET_TRIPLE}"

echo "Copying ${FFMPEG_SRC} -> ${FFMPEG_DEST}..."
cp "${FFMPEG_SRC}" "${FFMPEG_DEST}"
echo "Copying ${FFPROBE_SRC} -> ${FFPROBE_DEST}..."
cp "${FFPROBE_SRC}" "${FFPROBE_DEST}"

chmod +x "${FFMPEG_DEST}" "${FFPROBE_DEST}"

echo "Sidecars installed successfully:"
echo " - $(ls -lh "${FFMPEG_DEST}")"
echo " - $(ls -lh "${FFPROBE_DEST}")"
