$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw "Python 3.12+ not found. Install Python from python.org and enable the launcher." }
if (-not (Test-Path .venv)) { py -3.12 -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -e ".[dev,analytics]"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

function Set-EnvValue([string]$Key, [string]$Value) {
  $lines = @(Get-Content .env -ErrorAction SilentlyContinue)
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match "^$([regex]::Escape($Key))=") { "$Key=$Value"; $found = $true } else { $line }
  }
  if (-not $found) { $out += "$Key=$Value" }
  Set-Content -Path .env -Value $out -Encoding UTF8
}

# Prefer D:, otherwise the non-system filesystem drive with the most free space.
$dataRoot = $null
$drives = @(Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Free -gt 20GB } | Sort-Object Free -Descending)
$d = $drives | Where-Object { $_.Name -eq 'D' } | Select-Object -First 1
if ($d) { $dataRoot = 'D:\TQS_DATA' }
elseif ($drives.Count -gt 0 -and $drives[0].Name -ne 'C') { $dataRoot = "$($drives[0].Name):\TQS_DATA" }
else { $dataRoot = (Join-Path $PSScriptRoot 'data-lake') }
New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
Set-EnvValue 'TQS_DATA_LAKE_ROOT' $dataRoot
Set-EnvValue 'TQS_MODE' 'light'
Set-EnvValue 'TQS_AUTO_UPDATE' 'true'
$workers = [Math]::Max(1, [Math]::Min(4, [int]([Environment]::ProcessorCount / 2)))
Set-EnvValue 'TQS_HEAVY_WORKERS' "$workers"

# Detect a Google Drive Desktop root when possible; otherwise it can be set later in the UI/.env.
$driveExport = $null
$candidates = @(
  (Join-Path $env:USERPROFILE 'Google Drive\My Drive\Trading QS\TQS Snapshots'),
  (Join-Path $env:USERPROFILE 'Google Drive\Мой диск\Trading QS\TQS Snapshots')
)
foreach ($fs in (Get-PSDrive -PSProvider FileSystem)) {
  $candidates += (Join-Path $fs.Root 'My Drive\Trading QS\TQS Snapshots')
  $candidates += (Join-Path $fs.Root 'Мой диск\Trading QS\TQS Snapshots')
}
foreach ($candidate in $candidates) {
  $parent = Split-Path (Split-Path $candidate -Parent) -Parent
  if ($parent -and (Test-Path $parent)) { $driveExport = $candidate; break }
}
foreach ($candidate in $candidates) {
  $parent = Split-Path (Split-Path $candidate -Parent) -Parent
  if ($parent -and (Test-Path $parent)) { $driveExport = $candidate; break }
}
if ($driveExport) {
  New-Item -ItemType Directory -Path $driveExport -Force | Out-Null
  Set-EnvValue 'TQS_DRIVE_EXPORT_ROOT' $driveExport
}

# One-click owner entrypoint: desktop shortcut opens the launcher, not a console window.
try {
  $launcher = Join-Path $PSScriptRoot 'TQS-Launcher.cmd'
  $desktop = [Environment]::GetFolderPath('Desktop')
  if ($desktop -and (Test-Path $launcher)) {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut((Join-Path $desktop 'TQS Launcher.lnk'))
    $shortcut.TargetPath = $launcher
    $shortcut.WorkingDirectory = $PSScriptRoot
    $shortcut.Description = 'TQS Intelligence - launcher, updates, health and logs'
    $shortcut.Save()
  }
} catch {
  Write-Host "Desktop shortcut was not created: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "TQS Intelligence installed." -ForegroundColor Green
Write-Host "Data lake: $dataRoot" -ForegroundColor Cyan
if ($driveExport) { Write-Host "Google Drive snapshots: $driveExport" -ForegroundColor Cyan }
Write-Host "Run TQS-Launcher.cmd or use the TQS Launcher desktop shortcut." -ForegroundColor Green
