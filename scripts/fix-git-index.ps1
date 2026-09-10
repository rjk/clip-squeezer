<#
.SYNOPSIS
    Runs fix-git-index from clip-squeezer or delegates to the root workspace script.
#>
param(
    [switch]$Rebuild,
    [switch]$KillGitProcesses,
    [switch]$Unstage,
    [switch]$Renormalize
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$parentScript = Join-Path (Split-Path -Parent $scriptDir) "fix-git-index.ps1"
$rootScript = Join-Path (Split-Path -Parent (Split-Path -Parent $scriptDir)) "fix-git-index.ps1"

$targetScript = $null
if (Test-Path $rootScript) {
    $targetScript = $rootScript
} elseif (Test-Path $parentScript) {
    $targetScript = $parentScript
}

if ($targetScript) {
    & $targetScript @PSBoundParameters
} else {
    Write-Host "Error: Could not locate root fix-git-index.ps1" -ForegroundColor Red
}
