param(
    [switch]$NoStart
)

$ErrorActionPreference = "Stop"
$TqsRoot = $PSScriptRoot
$RepoRoot = Split-Path -Parent $TqsRoot
$DataDir = Join-Path $TqsRoot "data"
$ConfigPath = Join-Path $DataDir "server-node.json"
$StopMarker = Join-Path $DataDir "server-stop.flag"
$ServerStart = Join-Path $TqsRoot "server-start-windows.ps1"
$TaskName = "TQS Intelligence Server"
$RemoteTarget = "http://127.0.0.1:8787"
$ProgramW6432Path = [Environment]::GetEnvironmentVariable("ProgramW6432")

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdministrator)) {
    $quoted = '"' + $PSCommandPath + '"'
    $args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $quoted)
    if ($NoStart) { $args += "-NoStart" }
    Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $args
    exit 0
}

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
Set-Location $TqsRoot

function Set-EnvValue([string]$Key, [string]$Value) {
    $envPath = Join-Path $TqsRoot ".env"
    if (-not (Test-Path $envPath)) {
        if (Test-Path (Join-Path $TqsRoot ".env.example")) {
            Copy-Item (Join-Path $TqsRoot ".env.example") $envPath
        } else {
            New-Item -ItemType File -Path $envPath -Force | Out-Null
        }
    }
    $lines = @(Get-Content $envPath -ErrorAction SilentlyContinue)
    $found = $false
    $out = foreach ($line in $lines) {
        if ($line -match "^$([regex]::Escape($Key))=") {
            "$Key=$Value"
            $found = $true
        } else {
            $line
        }
    }
    if (-not $found) { $out += "$Key=$Value" }
    Set-Content -Path $envPath -Value $out -Encoding UTF8
}

function Invoke-NativeSafe {
    param(
        [Parameter(Mandatory=$true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [switch]$AllowFailure
    )
    $old = $ErrorActionPreference
    $rows = @()
    $code = 1
    try {
        $ErrorActionPreference = "Continue"
        $rows = & $FilePath @Arguments 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $old
    }
    $text = (($rows | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine).Trim()
    if ($code -ne 0 -and -not $AllowFailure) {
        throw "$FilePath $($Arguments -join ' ') failed with exit code $code $text"
    }
    return [pscustomobject]@{ ExitCode = $code; Text = $text }
}

function Find-Tailscale {
    $cmd = Get-Command tailscale.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @()
    if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles "Tailscale\tailscale.exe") }
    if ($ProgramW6432Path) { $candidates += (Join-Path $ProgramW6432Path "Tailscale\tailscale.exe") }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) { return $candidate }
    }
    return $null
}

function Find-Git {
    $cmd = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @()
    if ($env:ProgramFiles) {
        $candidates += (Join-Path $env:ProgramFiles "Git\cmd\git.exe")
        $candidates += (Join-Path $env:ProgramFiles "Git\bin\git.exe")
    }
    if ($ProgramW6432Path) { $candidates += (Join-Path $ProgramW6432Path "Git\cmd\git.exe") }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) { return $candidate }
    }
    return $null
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
    if ($targets.Count -gt 0) { Start-Sleep -Seconds 2 }
}

function Get-TailscaleStatus([string]$Exe) {
    $result = Invoke-NativeSafe -FilePath $Exe -Arguments @("status", "--json") -AllowFailure
    if ($result.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($result.Text)) { return $null }
    try { return ($result.Text | ConvertFrom-Json) } catch { return $null }
}

function Open-LoginUrlFromText([string]$Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
    $match = [regex]::Match($Text, 'https://[^\s]+')
    if (-not $match.Success) { return $false }
    try {
        Start-Process $match.Value | Out-Null
        return $true
    } catch {
        return $false
    }
}

Write-Host ""
Write-Host "TQS REMOTE NODE SETUP" -ForegroundColor Cyan
Write-Host "Private remote access only. TQS stays bound to 127.0.0.1." -ForegroundColor DarkGray
Write-Host ""

if (-not (Test-Path (Join-Path $TqsRoot ".venv\Scripts\python.exe"))) {
    throw "TQS virtual environment is missing. Run install-windows.cmd once before server setup."
}
if (-not (Test-Path $ServerStart)) {
    throw "server-start-windows.ps1 is missing. Update TQS first."
}

$git = Find-Git
if (-not $git) {
    throw "Git was not found. TQS server auto-update requires Git for Windows."
}

$tailscale = Find-Tailscale
if (-not $tailscale) {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host "Installing Tailscale..." -ForegroundColor Yellow
        Invoke-NativeSafe -FilePath $winget.Source -Arguments @("install", "--id", "Tailscale.Tailscale", "--exact", "--silent", "--accept-package-agreements", "--accept-source-agreements") -AllowFailure | Out-Null
        Start-Sleep -Seconds 3
        $tailscale = Find-Tailscale
    }
}
if (-not $tailscale) {
    Start-Process "https://tailscale.com/download/windows" | Out-Null
    throw "Tailscale could not be installed automatically. Install it from the opened page and run server setup again."
}

try {
    $services = @(Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "Tailscale*" })
    foreach ($service in $services) {
        if ($service.Status -ne "Running") {
            try { Start-Service -Name $service.Name -ErrorAction Stop } catch {}
        }
    }
} catch {}

Write-Host "Connecting Tailscale..." -ForegroundColor Yellow
$status = Get-TailscaleStatus $tailscale
if (-not $status -or $status.BackendState -ne "Running") {
    $up = Invoke-NativeSafe -FilePath $tailscale -Arguments @("up", "--unattended=true", "--timeout=5s") -AllowFailure
    [void](Open-LoginUrlFromText $up.Text)
    if ($up.ExitCode -ne 0) {
        Write-Host "Complete the one-time Tailscale sign-in in the browser." -ForegroundColor Yellow
    }
    $deadline = (Get-Date).AddMinutes(3)
    do {
        Start-Sleep -Seconds 2
        $status = Get-TailscaleStatus $tailscale
        if ($status -and $status.BackendState -eq "Running") { break }
    } while ((Get-Date) -lt $deadline)
}
if (-not $status -or $status.BackendState -ne "Running") {
    throw "Tailscale is installed but not connected. Sign in once and run server setup again."
}

$unattended = Invoke-NativeSafe -FilePath $tailscale -Arguments @("up", "--unattended=true", "--timeout=15s") -AllowFailure
if ($unattended.ExitCode -ne 0) {
    Write-Host "Warning: unattended mode could not be confirmed: $($unattended.Text)" -ForegroundColor Yellow
}

Write-Host "Configuring private HTTPS access..." -ForegroundColor Yellow
$serve = Invoke-NativeSafe -FilePath $tailscale -Arguments @("serve", "--bg", "--yes", $RemoteTarget) -AllowFailure
if ($serve.ExitCode -ne 0) {
    $opened = Open-LoginUrlFromText $serve.Text
    if ($opened) {
        Write-Host "Approve Tailscale HTTPS/Serve in the browser. Retrying in 8 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 8
        $serve = Invoke-NativeSafe -FilePath $tailscale -Arguments @("serve", "--bg", "--yes", $RemoteTarget) -AllowFailure
    }
}
if ($serve.ExitCode -ne 0) {
    throw "Tailscale Serve setup failed: $($serve.Text)"
}

$status = Get-TailscaleStatus $tailscale
$dnsName = ""
if ($status -and $status.Self -and $status.Self.DNSName) {
    $dnsName = ([string]$status.Self.DNSName).Trim().TrimEnd(".")
}
$remoteUrl = if ($dnsName) { "https://$dnsName" } else { "" }

Set-EnvValue "TQS_HOST" "127.0.0.1"
Set-EnvValue "TQS_PORT" "8787"
Set-EnvValue "TQS_AUTO_UPDATE" "true"
Set-EnvValue "TQS_SERVER_MODE" "true"
Set-EnvValue "TQS_UPDATE_CHECK_SECONDS" "300"

try {
    Invoke-NativeSafe -FilePath $git -Arguments @("config", "--system", "--add", "safe.directory", $RepoRoot) -AllowFailure | Out-Null
} catch {}

$node = [ordered]@{
    schema_version = 1
    enabled = $true
    server_mode = $true
    remote_provider = "tailscale"
    task_name = $TaskName
    setup_at_ms = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    tailscale_exe = $tailscale
    git_exe = $git
    remote_url = $remoteUrl
    update_check_seconds = 300
    auto_update = $true
    bind_host = "127.0.0.1"
    port = 8787
    public_exposure = $false
}
$node | ConvertTo-Json -Depth 6 | Set-Content -Path $ConfigPath -Encoding UTF8

$controlPath = Join-Path $DataDir "control.json"
try {
    if (Test-Path $controlPath) {
        $control = Get-Content $controlPath -Raw | ConvertFrom-Json
    } else {
        $control = [pscustomobject]@{ mode = "light" }
    }
    if ($null -eq $control.PSObject.Properties["auto_update"]) {
        $control | Add-Member -NotePropertyName auto_update -NotePropertyValue $true
    } else {
        $control.auto_update = $true
    }
    $control | ConvertTo-Json -Depth 8 | Set-Content -Path $controlPath -Encoding UTF8
} catch {
    Write-Host "Control auto-update flag could not be rewritten: $($_.Exception.Message)" -ForegroundColor Yellow
}

if (Test-Path $StopMarker) {
    Remove-Item $StopMarker -Force -ErrorAction SilentlyContinue
}

Write-Host "Registering Windows autostart task..." -ForegroundColor Yellow
$taskArgument = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $ServerStart + '"'
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $taskArgument -WorkingDirectory $TqsRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue } catch {}
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "TQS Intelligence always-on server: auto-start, auto-update and private Tailscale access." -Force | Out-Null

if (-not $NoStart) {
    # Hand ownership from any pre-setup interactive Supervisor to the scheduled
    # SYSTEM task. Without this takeover a second Supervisor would race for
    # 127.0.0.1:8787 until the old process exits.
    Stop-TqsProcesses
    try { Start-ScheduledTask -TaskName $TaskName } catch {}
}

$summaryPath = Join-Path $DataDir "remote-access.txt"
$summary = @(
    "TQS REMOTE NODE"
    "Remote URL: $remoteUrl"
    "Provider: Tailscale Serve (private tailnet only)"
    "Local bind: http://127.0.0.1:8787"
    "Autostart task: $TaskName"
    "Auto-update check: every 300 seconds"
    "Public Funnel: NOT configured by TQS"
    ""
    "Mac: install Tailscale, sign in to the same account/tailnet, then open the Remote URL in Safari/Chrome."
)
$summary | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host ""
Write-Host "TQS SERVER READY" -ForegroundColor Green
if ($remoteUrl) {
    Write-Host "Remote URL: $remoteUrl" -ForegroundColor Cyan
} else {
    Write-Host "Remote URL will appear in Launcher after Tailscale DNS is available." -ForegroundColor Yellow
}
Write-Host "Autostart: enabled at Windows startup" -ForegroundColor Green
Write-Host "Auto-update: enabled, check every 5 minutes" -ForegroundColor Green
Write-Host "Security: loopback-only TQS + private Tailscale Serve; no public port opened." -ForegroundColor Green
Write-Host ""
Write-Host "Mac needs one-time Tailscale sign-in to the same account. Then bookmark the Remote URL." -ForegroundColor Cyan
