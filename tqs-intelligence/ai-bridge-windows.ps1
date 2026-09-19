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
$HealthUrl = "http://127.0.0.1:8787/api/health"

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
        health_ok = $false
        health_error = $null
        last_health_publish_ms = 0
        last_error = $null
        local_path = (Join-Path $LocalDir "TQS_LIVE_AUDIT.json")
        interval_seconds = $IntervalSeconds
    }

    $target = Get-TargetPath
    if ($target) {
        $state.target_path = $target
        $state.drive_connected = $true
    }

    try {
        $health = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 8
        $state.health_ok = [bool]$health.ok
        $state.version = [string]$health.version
        $healthLines = @(
            "TQS LIVE HEALTH",
            "generated_at_ms: $($health.generated_at_ms)",
            "version: $($health.version)",
            "ok: $($health.ok)",
            "mode: $($health.control.mode)",
            "data_lake_root: $($health.control.data_lake_root)",
            "refresh_count: $($health.runtime.refresh_count)",
            "runtime_error: $($health.runtime.last_error)"
        )
        $healthText = ($healthLines -join [Environment]::NewLine) + [Environment]::NewLine
        Write-JsonAtomic -Path (Join-Path $LocalDir "TQS_LIVE_HEALTH.json") -Value $health
        Write-TextAtomic -Path (Join-Path $LocalDir "TQS_LIVE_HEALTH.txt") -Text $healthText
        $state.last_health_publish_ms = $now
        if ($target) {
            Write-JsonAtomic -Path (Join-Path $target "TQS_LIVE_HEALTH.json") -Value $health
            Write-TextAtomic -Path (Join-Path $target "TQS_LIVE_HEALTH.txt") -Text $healthText
            $state.last_drive_publish_ms = $now
        }
    } catch {
        $state.health_error = "$($_.Exception.GetType().Name): $($_.Exception.Message)"
        if (-not $target) { $state.drive_connected = $false }
    }

    try {
        $audit = Invoke-RestMethod -Uri $AuditUrl -Method Get -TimeoutSec 20
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

        if ($target) {
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
        $auditError = "$($_.Exception.GetType().Name): $($_.Exception.Message)"
        $state.last_error = "audit: $auditError"
    }

    try { Write-JsonAtomic -Path $StatePath -Value $state } catch {}
    return $state
}

do {
    $result = Publish-Audit
    if ($Once) { break }
    Start-Sleep -Seconds ([Math]::Max(60, $IntervalSeconds))
} while ($true)
