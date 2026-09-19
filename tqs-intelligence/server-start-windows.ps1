param()

$ErrorActionPreference = "Continue"
$TqsRoot = $PSScriptRoot
$DataDir = Join-Path $TqsRoot "data"
$ConfigPath = Join-Path $DataDir "server-node.json"
$StopMarker = Join-Path $DataDir "server-stop.flag"
$RuntimeLog = Join-Path $DataDir "runtime.log"
$Python = Join-Path $TqsRoot ".venv\Scripts\python.exe"

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
Set-Location $TqsRoot

function Write-ServerLog([string]$Message) {
    $line = "[$([DateTime]::Now.ToString('yyyy-MM-dd HH:mm:ss'))] SERVER $Message"
    try { Add-Content -Path $RuntimeLog -Value $line -Encoding UTF8 } catch {}
}

if (-not (Test-Path $ConfigPath)) {
    Write-ServerLog "server-node.json missing; server task exits"
    exit 0
}
try {
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
} catch {
    Write-ServerLog "server-node.json invalid: $($_.Exception.Message)"
    exit 2
}
if (-not $config.enabled) {
    Write-ServerLog "server mode disabled; task exits"
    exit 0
}
if (Test-Path $StopMarker) {
    Write-ServerLog "owner stop marker present; task exits cleanly"
    exit 0
}
if (-not (Test-Path $Python)) {
    Write-ServerLog "python venv missing: $Python"
    exit 3
}

if ($config.git_exe -and (Test-Path ([string]$config.git_exe))) {
    $gitDir = Split-Path -Parent ([string]$config.git_exe)
    if ($gitDir) { $env:PATH = "$gitDir;$env:PATH" }
}
if ($config.tailscale_exe -and (Test-Path ([string]$config.tailscale_exe))) {
    $ts = [string]$config.tailscale_exe
    $tsDir = Split-Path -Parent $ts
    if ($tsDir) { $env:PATH = "$tsDir;$env:PATH" }
    try {
        & $ts status --json | Out-Null
        & $ts serve --bg --yes http://127.0.0.1:8787 | Out-Null
    } catch {
        Write-ServerLog "tailscale reassert warning: $($_.Exception.Message)"
    }
}

Write-ServerLog "starting supervisor in always-on server mode"
$env:TQS_SERVER_MODE = "true"
$env:TQS_HOST = "127.0.0.1"
$env:TQS_PORT = "8787"

try {
    & $Python -m tqs_intelligence.supervisor *>> $RuntimeLog
    $code = $LASTEXITCODE
    Write-ServerLog "supervisor exited code=$code"
    exit $code
} catch {
    Write-ServerLog "supervisor launch failed: $($_.Exception.Message)"
    exit 4
}
