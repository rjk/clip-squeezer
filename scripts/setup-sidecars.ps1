# Script to setup local Tauri 2 sidecar executables for Windows MSVC target triple
param(
    [string]$TargetTriple = "x86_64-pc-windows-msvc"
)
$ErrorActionPreference = "Stop"

$binDir = Join-Path $PSScriptRoot "..\src-tauri\binaries"

if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
}

$ffmpegDest = Join-Path $binDir "ffmpeg-$TargetTriple.exe"
$ffprobeDest = Join-Path $binDir "ffprobe-$TargetTriple.exe"

# Locate source ffmpeg / ffprobe
$chocoFfmpeg = "C:\ProgramData\chocolatey\lib\ffmpeg\tools\ffmpeg\bin\ffmpeg.exe"
$chocoFfprobe = "C:\ProgramData\chocolatey\lib\ffmpeg\tools\ffmpeg\bin\ffprobe.exe"

if ((Test-Path $chocoFfmpeg) -and (Test-Path $chocoFfprobe)) {
    Write-Host "Copying FFmpeg and FFprobe from Chocolatey installation..."
    Copy-Item -Path $chocoFfmpeg -Destination $ffmpegDest -Force
    Copy-Item -Path $chocoFfprobe -Destination $ffprobeDest -Force
} else {
    Write-Host "Chocolatey path not found, checking PATH..."
    $ffmpegCmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
    $ffprobeCmd = Get-Command ffprobe -ErrorAction SilentlyContinue
    if ($ffmpegCmd -and $ffprobeCmd) {
        Copy-Item -Path $ffmpegCmd.Source -Destination $ffmpegDest -Force
        Copy-Item -Path $ffprobeCmd.Source -Destination $ffprobeDest -Force
    } else {
        Write-Error "Could not find ffmpeg.exe or ffprobe.exe on system!"
    }
}

Write-Host "Sidecars installed successfully:"
Write-Host " - $ffmpegDest ($((Get-Item $ffmpegDest).Length / 1MB) MB)"
Write-Host " - $ffprobeDest ($((Get-Item $ffprobeDest).Length / 1MB) MB)"
