param(
    [switch]$Once,
    [int]$IntervalSeconds = 120
)

$ErrorActionPreference = "SilentlyContinue"
$TqsRoot = $PSScriptRoot
$DataDir = Join-Path $TqsRoot "data"
$LocalDir = Join-Path $DataDir "ai-bridge"
$StatePath = Join-Path $DataDir "ai-bridge-state.json"
$NodeConfigPath = Join-Path $DataDir "server-node.json"
$AuditUrl = "http://127.0.0.1:8787/api/audit"

New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null

function Write-JsonAtomic {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)]$Value
    )
    $dir = Split-Path -Parent $Path
    if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $tmp = $Path + ".tmp"
    $json = $Value | ConvertTo-Json -Depth 30
    [System.IO.File]::WriteAllText($tmp, $json, [System.Text.UTF8Encoding]::new($false))
    Move-Item -Force $tmp $Path
}

function Write-TextAtomic {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$Text
    )
    $dir = Split-Path -Parent $Path
    if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $tmp = $Path + ".tmp"
    [System.IO.File]::WriteAllText($tmp, $Text, [System.Text.UTF8Encoding]::new($false))
    Move-Item -Force $tmp $Path
}

function Get-NodeConfig {
    try {
        if (Test-Path $NodeConfigPath) {
            return Get-Content $NodeConfigPath -Raw | ConvertFrom-Json
        }
    } catch {}
    return $null
}

function Find-RemoteNodeParent {
    param([string]$Base)
    if (-not $Base -or -not (Test-Path $Base)) { return $null }

    $relativeVariants = @(
        "Trading QS\08_АВТОМАТИЗАЦИЯ И ПРОДУКТ\03_TQS REMOTE NODE",
        "My Drive\Trading QS\08_АВТОМАТИЗАЦИЯ И ПРОДУКТ\03_TQS REMOTE NODE",
        "Мой диск\Trading QS\08_АВТОМАТИЗАЦИЯ И ПРОДУКТ\03_TQS REMOTE NODE"
    )
    foreach ($rel in $relativeVariants) {
        try {
            $candidate = Join-Path $Base $rel
            if (Test-Path $candidate) { return $candidate }
        } catch {}
    }
    return $null
}

function Find-GoogleDriveTarget {
    $cfg = Get-NodeConfig
    if ($cfg -and $cfg.ai_bridge_drive_path) {
        $configured = [string]$cfg.ai_bridge_drive_path
        if (Test-Path $configured) { return $configured }
    }
    if ($env:TQS_AI_BRIDGE_DRIVE_PATH -and (Test-Path $env:TQS_AI_BRIDGE_DRIVE_PATH)) {
        return $env:TQS_AI_BRIDGE_DRIVE_PATH
    }

    $roots = New-Object System.Collections.Generic.List[string]
    try {
        foreach ($drive in (Get-PSDrive -PSProvider FileSystem)) {
            if ($drive.Root -and -not $roots.Contains([string]$drive.Root)) {
                $roots.Add([string]$drive.Root)
            }
        }
    } catch {}
    foreach ($base in @(
        $env:USERPROFILE,
        (Join-Path $env:USERPROFILE "Google Drive"),
        (Join-Path $env:USERPROFILE "My Drive")
    )) {
        if ($base -and -not $roots.Contains([string]$base)) { $roots.Add([string]$base) }
    }

    foreach ($root in $roots) {
        $parent = Find-RemoteNodeParent $root
        if (-not $parent) { continue }
        try {
            $existing = Get-ChildItem -Path $parent -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -like "RUNTIME*TQS AI BRIDGE*" } |
                Select-Object -First 1
            if ($existing) { return $existing.FullName }
        } catch {}
        try {
            $target = Join-Path $parent "RUNTIME — TQS AI BRIDGE"
            New-Item -ItemType Directory -Force -Path $target | Out-Null
            if (Test-Path $target) { return $target }
        } catch {}
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
        $audit = Invoke-RestMethod -Uri $AuditUrl -Method Get -TimeoutSec 25
        $textLines = @(
            "TQS LIVE AUDIT",
            "generated_at_ms: $($audit.generated_at_ms)",
            "version: $($audit.version)",
            "overall: $($audit.overall)",
            "",
            "CHECKS"
        )
        foreach ($check in @($audit.checks)) {
            $textLines += "[$(([string]$check.status).ToUpper())] $($check.title): $($check.detail)"
        }
        $textLines += ""
        $textLines += "AI NOTE"
        $textLines += [string]$audit.scope_note_ru
        $text = ($textLines -join [Environment]::NewLine) + [Environment]::NewLine

        $state.audit_overall = [string]$audit.overall
        $state.version = [string]$audit.version

        $localJson = Join-Path $LocalDir "TQS_LIVE_AUDIT.json"
        $localText = Join-Path $LocalDir "TQS_LIVE_AUDIT.txt"
        Write-JsonAtomic -Path $localJson -Value $audit
        Write-TextAtomic -Path $localText -Text $text
        $state.last_publish_ms = $now

        $target = Find-GoogleDriveTarget
        if ($target) {
            $state.target_path = $target
            try {
                Write-JsonAtomic -Path (Join-Path $target "TQS_LIVE_AUDIT.json") -Value $audit
                Write-TextAtomic -Path (Join-Path $target "TQS_LIVE_AUDIT.txt") -Text $text

                # One compact hourly history file makes regressions and overnight
                # failures inspectable by another ChatGPT session without exposing
                # raw private account databases.
                $history = Join-Path $target "history"
                New-Item -ItemType Directory -Force -Path $history | Out-Null
                $hourName = "TQS-AUDIT-" + (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HH") + ".json"
                $hourPath = Join-Path $history $hourName
                if (-not (Test-Path $hourPath)) {
                    Write-JsonAtomic -Path $hourPath -Value $audit
                }
                try {
                    Get-ChildItem -Path $history -Filter "TQS-AUDIT-*.json" -File |
                        Where-Object { $_.LastWriteTimeUtc -lt (Get-Date).ToUniversalTime().AddDays(-7) } |
                        Remove-Item -Force -ErrorAction SilentlyContinue
                } catch {}
                $state.drive_connected = $true
                $state.last_drive_publish_ms = $now
            } catch {
                $state.drive_connected = $false
                $state.last_error = "Google Drive publish failed: $($_.Exception.GetType().Name): $($_.Exception.Message)"
            }
        } else {
            $state.last_error = "Google Drive target not detected; local audit is still being updated."
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
