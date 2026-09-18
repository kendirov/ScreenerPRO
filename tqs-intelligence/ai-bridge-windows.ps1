param(
    [switch]$Once,
    [int]$IntervalSeconds = 120
)

$ErrorActionPreference = "Stop"
$TqsRoot = $PSScriptRoot
$DataDir = Join-Path $TqsRoot "data"
$LocalDir = Join-Path $DataDir "ai-bridge"
$StatePath = Join-Path $DataDir "ai-bridge-state.json"
$NodeConfigPath = Join-Path $DataDir "server-node.json"
$AuditUrl = "http://127.0.0.1:8787/api/audit"

New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null

function Write-JsonAtomic {
    param([string]$Path, $Value)
    $dir = Split-Path -Parent $Path
    if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $tmp = $Path + ".tmp"
    $Value | ConvertTo-Json -Depth 40 | Set-Content -Path $tmp -Encoding UTF8
    Move-Item -Force $tmp $Path
}

function Write-TextAtomic {
    param([string]$Path, [string]$Text)
    $dir = Split-Path -Parent $Path
    if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $tmp = $Path + ".tmp"
    Set-Content -Path $tmp -Value $Text -Encoding UTF8
    Move-Item -Force $tmp $Path
}

function Get-TargetPath {
    try {
        if (-not (Test-Path $NodeConfigPath)) { return $null }
        $cfg = Get-Content $NodeConfigPath -Raw | ConvertFrom-Json
        $target = [string]$cfg.ai_bridge_drive_path
        if ($target -and (Test-Path $target)) { return $target }
    } catch {}
    if ($env:TQS_AI_BRIDGE_DRIVE_PATH -and (Test-Path $env:TQS_AI_BRIDGE_DRIVE_PATH)) {
        return $env:TQS_AI_BRIDGE_DRIVE_PATH
    }
    return $null
}

function Publish-Audit {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $state = [ordered]@{
        last_attempt_ms = $now
        last_publish_ms = 0
        last_drive_publish_ms = 0
        target_path = $null
        drive_connected = $false
        audit_overall = $null
        version = $null
        last_error = $null
        local_path = (Join-Path $LocalDir "TQS_LIVE_AUDIT.json")
        interval_seconds = $IntervalSeconds
    }

    try {
        $audit = Invoke-RestMethod -Uri $AuditUrl -Method Get -TimeoutSec 30
        $state.audit_overall = [string]$audit.overall
        $state.version = [string]$audit.version

        $lines = @(
            "TQS LIVE AUDIT",
            "generated_at_ms: $($audit.generated_at_ms)",
            "version: $($audit.version)",
            "overall: $($audit.overall)",
            "",
            "CHECKS"
        )
        foreach ($check in @($audit.checks)) {
            $lines += "[$(([string]$check.status).ToUpper())] $($check.title): $($check.detail)"
        }
        $text = ($lines -join [Environment]::NewLine) + [Environment]::NewLine

        Write-JsonAtomic -Path (Join-Path $LocalDir "TQS_LIVE_AUDIT.json") -Value $audit
        Write-TextAtomic -Path (Join-Path $LocalDir "TQS_LIVE_AUDIT.txt") -Text $text
        $state.last_publish_ms = $now

        $target = Get-TargetPath
        if ($target) {
            $state.target_path = $target
            Write-JsonAtomic -Path (Join-Path $target "TQS_LIVE_AUDIT.json") -Value $audit
            Write-TextAtomic -Path (Join-Path $target "TQS_LIVE_AUDIT.txt") -Text $text
            $state.drive_connected = $true
            $state.last_drive_publish_ms = $now

            $history = Join-Path $target "history"
            New-Item -ItemType Directory -Force -Path $history | Out-Null
            $hourName = "TQS-AUDIT-" + (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HH") + ".json"
            $hourPath = Join-Path $history $hourName
            if (-not (Test-Path $hourPath)) {
                Write-JsonAtomic -Path $hourPath -Value $audit
            }
            Get-ChildItem $history -Filter "TQS-AUDIT-*.json" -File -ErrorAction SilentlyContinue |
                Where-Object { $_.LastWriteTimeUtc -lt (Get-Date).ToUniversalTime().AddDays(-7) } |
                Remove-Item -Force -ErrorAction SilentlyContinue
        } else {
            $state.last_error = "Configured Google Drive target was not found."
        }
    } catch {
        $state.last_error = "$($_.Exception.GetType().Name): $($_.Exception.Message)"
    }

    try { Write-JsonAtomic -Path $StatePath -Value $state } catch {}
    return $state
}

do {
    $result = Publish-Audit
    if ($Once) { break }
    Start-Sleep -Seconds ([Math]::Max(60, $IntervalSeconds))
} while ($true)
