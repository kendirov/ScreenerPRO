param(
    [switch]$FromApp,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$TqsRoot = $PSScriptRoot
$RepoRoot = Split-Path -Parent $TqsRoot
$StatePath = Join-Path $TqsRoot "data\update-state.json"
$Python = Join-Path $TqsRoot ".venv\Scripts\python.exe"
$HealthUrl = "http://127.0.0.1:8787/api/health"
$AppUrl = "http://127.0.0.1:8787/?fresh=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"

function Write-UpdateState {
    param(
        [string]$Status,
        [string]$Step,
        [string]$Message = "",
        [string]$OldHead = "",
        [string]$NewHead = "",
        [string]$ErrorText = ""
    )
    $dir = Split-Path -Parent $StatePath
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $payload = [ordered]@{
        updated_at_ms = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        status = $Status
        step = $Step
        message = $Message
        old_head = $OldHead
        new_head = $NewHead
        error = $ErrorText
    }
    $payload | ConvertTo-Json -Depth 6 | Set-Content -Path $StatePath -Encoding UTF8
}

function Invoke-NativeSafe {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    $previousPreference = $ErrorActionPreference
    $output = @()
    $exitCode = 1
    try {
        # Windows PowerShell 5.1 can surface ordinary native stderr (for example
        # `git fetch` lines beginning with "From ...") as ErrorRecord objects.
        # Native stderr is diagnostic text, not a failure signal. Exit code is authoritative.
        $ErrorActionPreference = "Continue"
        $output = & $FilePath @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }

    $text = (($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine).Trim()
    if ($exitCode -ne 0 -and -not $AllowFailure) {
        throw "$FilePath $($Arguments -join ' ') failed with exit code $exitCode`n$text"
    }
    return [pscustomobject]@{ ExitCode = $exitCode; Text = $text }
}

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
    $result = Invoke-NativeSafe -FilePath "git" -Arguments (@('-C', $RepoRoot) + $Args)
    return $result.Text
}

function Test-GitAncestor {
    param([string]$Base, [string]$Head)
    $result = Invoke-NativeSafe -FilePath "git" -Arguments @('-C', $RepoRoot, 'merge-base', '--is-ancestor', $Base, $Head) -AllowFailure
    return $result.ExitCode -eq 0
}

function Install-TqsDependencies {
    $result = Invoke-NativeSafe -FilePath $Python -Arguments @('-m', 'pip', 'install', '-e', '.[dev,analytics]') -AllowFailure
    if ($result.ExitCode -ne 0) {
        throw "Dependency install failed with exit code $($result.ExitCode)`n$($result.Text)"
    }
}

function Stop-TqsProcesses {
    $targets = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessId -ne $PID -and $_.CommandLine -and (
            $_.CommandLine -match 'tqs_intelligence\.supervisor' -or
            $_.CommandLine -match 'tqs_intelligence\.api' -or
            $_.CommandLine -match 'uvicorn.*tqs_intelligence\.api'
        )
    }
    foreach ($proc in $targets) {
        try { Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
    }
    Start-Sleep -Seconds 2
}

function Start-Tqs {
    if (-not (Test-Path $Python)) {
        throw "Virtual environment not found: $Python. Run install-windows.cmd once."
    }
    Start-Process -FilePath $Python -ArgumentList @('-m','tqs_intelligence.supervisor') -WorkingDirectory $TqsRoot | Out-Null
}

function Wait-TqsHealthy {
    param([int]$TimeoutSeconds = 90)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $result = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 3
            if ($result.ok -eq $true) { return $true }
        } catch {}
        Start-Sleep -Seconds 1
    }
    return $false
}

Set-Location $TqsRoot
$oldHead = ""
$newHead = ""
$branch = ""

try {
    Write-UpdateState -Status "running" -Step "check" -Message "Проверяю GitHub..."

    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw "Git is not available in PATH."
    }
    if (-not (Test-Path $Python)) {
        throw "TQS virtual environment is missing. Run install-windows.cmd once."
    }

    $branch = Invoke-Git branch --show-current
    if ([string]::IsNullOrWhiteSpace($branch)) {
        throw "Detached HEAD: automatic update is disabled."
    }

    $dirty = Invoke-Git status --porcelain
    if (-not [string]::IsNullOrWhiteSpace($dirty)) {
        throw "Repository has local uncommitted changes. Update stopped to protect them."
    }

    $oldHead = Invoke-Git rev-parse HEAD
    Write-UpdateState -Status "running" -Step "fetch" -Message "Получаю свежую версию..." -OldHead $oldHead
    Invoke-Git fetch --prune origin $branch | Out-Null

    $remoteRef = "origin/$branch"
    $newHead = Invoke-Git rev-parse $remoteRef
    if ($newHead -eq $oldHead) {
        if (-not (Wait-TqsHealthy -TimeoutSeconds 3)) {
            Write-UpdateState -Status "running" -Step "start" -Message "Версия свежая. Запускаю TQS..." -OldHead $oldHead -NewHead $newHead
            Start-Tqs
            if (-not (Wait-TqsHealthy -TimeoutSeconds 60)) {
                throw "TQS is current but failed to start."
            }
        }
        Write-UpdateState -Status "noop" -Step "done" -Message "Свежая версия уже установлена и TQS работает." -OldHead $oldHead -NewHead $newHead
        if (-not $NoBrowser) { Start-Process $AppUrl | Out-Null }
        exit 0
    }

    if (-not (Test-GitAncestor -Base 'HEAD' -Head $remoteRef)) {
        throw "Remote branch is not a fast-forward of the local branch. Manual review is required."
    }

    Write-UpdateState -Status "running" -Step "stopping" -Message "Останавливаю TQS..." -OldHead $oldHead -NewHead $newHead
    if ($FromApp) { Start-Sleep -Seconds 2 }
    Stop-TqsProcesses

    Write-UpdateState -Status "running" -Step "fast-forward" -Message "Применяю новую версию..." -OldHead $oldHead -NewHead $newHead
    Invoke-Git merge --ff-only $remoteRef | Out-Null

    Write-UpdateState -Status "running" -Step "install" -Message "Обновляю зависимости..." -OldHead $oldHead -NewHead $newHead
    Install-TqsDependencies

    Write-UpdateState -Status "running" -Step "start" -Message "Запускаю TQS..." -OldHead $oldHead -NewHead $newHead
    Start-Tqs

    Write-UpdateState -Status "running" -Step "healthcheck" -Message "Проверяю новую версию..." -OldHead $oldHead -NewHead $newHead
    if (-not (Wait-TqsHealthy -TimeoutSeconds 90)) {
        throw "New version failed healthcheck."
    }

    Write-UpdateState -Status "success" -Step "done" -Message "TQS обновлён и работает." -OldHead $oldHead -NewHead $newHead
    if (-not $NoBrowser) {
        Start-Sleep -Seconds 1
        Start-Process $AppUrl | Out-Null
    }
    exit 0
}
catch {
    $err = $_.Exception.Message
    try {
        if ($oldHead -and $newHead -and $oldHead -ne $newHead) {
            Write-UpdateState -Status "running" -Step "rollback" -Message "Новая версия не запустилась. Откатываю..." -OldHead $oldHead -NewHead $newHead -ErrorText $err
            Stop-TqsProcesses
            $rollback = Invoke-NativeSafe -FilePath "git" -Arguments @('-C', $RepoRoot, 'reset', '--hard', $oldHead) -AllowFailure
            if ($rollback.ExitCode -eq 0 -and (Test-Path $Python)) {
                try { Install-TqsDependencies } catch {}
                Start-Tqs
                $rollbackHealthy = Wait-TqsHealthy -TimeoutSeconds 60
                if ($rollbackHealthy) {
                    Write-UpdateState -Status "rolled_back" -Step "rollback" -Message "Выполнен откат на рабочую версию." -OldHead $oldHead -NewHead $newHead -ErrorText $err
                    if (-not $NoBrowser) { Start-Process $AppUrl | Out-Null }
                    exit 2
                }
            }
        }
    } catch {}

    Write-UpdateState -Status "failed" -Step "failed" -Message "Обновление не выполнено." -OldHead $oldHead -NewHead $newHead -ErrorText $err
    Write-Host "TQS UPDATE FAILED: $err" -ForegroundColor Red
    if (-not $FromApp) { Read-Host "Press Enter to close" | Out-Null }
    exit 1
}
