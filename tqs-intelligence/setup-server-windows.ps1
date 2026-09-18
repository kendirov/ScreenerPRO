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
$AiBridgeScript = Join-Path $TqsRoot "ai-bridge-windows.ps1"
$TaskName = "TQS Intelligence Server"
$AiBridgeTaskName = "TQS AI Bridge"
$RemoteTarget = "http://127.0.0.1:8787"
$ProgramW6432Path = [Environment]::GetEnvironmentVariable("ProgramW6432")

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdministrator)) {
    $quotedScript = '"' + $PSCommandPath + '"'
    $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $quotedScript)
    if ($NoStart) { $arguments += "-NoStart" }
    Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $arguments
    exit 0
}

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
Set-Location $TqsRoot

function Set-EnvValue {
    param(
        [Parameter(Mandatory=$true)][string]$Key,
        [Parameter(Mandatory=$true)][string]$Value
    )

    $envPath = Join-Path $TqsRoot ".env"
    if (-not (Test-Path $envPath)) {
        $example = Join-Path $TqsRoot ".env.example"
        if (Test-Path $example) {
            Copy-Item $example $envPath
        } else {
            New-Item -ItemType File -Path $envPath -Force | Out-Null
        }
    }

    $lines = @(Get-Content $envPath -ErrorAction SilentlyContinue)
    $found = $false
    $output = foreach ($line in $lines) {
        if ($line -match ("^" + [regex]::Escape($Key) + "=")) {
            $found = $true
            "$Key=$Value"
        } else {
            $line
        }
    }
    if (-not $found) { $output += "$Key=$Value" }
    Set-Content -Path $envPath -Value $output -Encoding UTF8
}

function Invoke-NativeSafe {
    param(
        [Parameter(Mandatory=$true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [switch]$AllowFailure
    )

    $oldPreference = $ErrorActionPreference
    $rows = @()
    $exitCode = 1
    try {
        $ErrorActionPreference = "Continue"
        $rows = & $FilePath @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $oldPreference
    }

    $text = (($rows | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine).Trim()
    if ($exitCode -ne 0 -and -not $AllowFailure) {
        throw "$FilePath $($Arguments -join ' ') failed with exit code $exitCode $text"
    }
    return [pscustomobject]@{ ExitCode = $exitCode; Text = $text }
}

function Find-Tailscale {
    $command = Get-Command tailscale.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $candidates = @()
    if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles "Tailscale\tailscale.exe") }
    if ($ProgramW6432Path) { $candidates += (Join-Path $ProgramW6432Path "Tailscale\tailscale.exe") }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) { return $candidate }
    }
    return $null
}

function Find-Git {
    $command = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

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

function Resolve-OwnerUser {
    try {
        if (Test-Path $ConfigPath) {
            $existing = Get-Content $ConfigPath -Raw | ConvertFrom-Json
            if ($existing.owner_user) { return [string]$existing.owner_user }
        }
    } catch {}

    try {
        $interactive = (Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue).UserName
        if ($interactive) { return [string]$interactive }
    } catch {}

    try {
        $current = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        if ($current -and -not $current.EndsWith("\SYSTEM")) { return [string]$current }
    } catch {}

    try {
        $parts = $TqsRoot -split "\\"
        $usersIndex = [Array]::IndexOf($parts, "Users")
        if ($usersIndex -ge 0 -and ($usersIndex + 1) -lt $parts.Length) {
            $localName = $parts[$usersIndex + 1]
            if ($localName) { return "$env:COMPUTERNAME\$localName" }
        }
    } catch {}

    return $null
}

function Stop-TqsProcesses {
    $targets = @(
        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object {
                $_.ProcessId -ne $PID -and
                $_.CommandLine -and
                (
                    $_.CommandLine -match "tqs_intelligence\.supervisor" -or
                    $_.CommandLine -match "tqs_intelligence\.api" -or
                    $_.CommandLine -match "uvicorn.*tqs_intelligence\.api"
                )
            }
    )
    foreach ($process in $targets) {
        try { Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
    }
    if ($targets.Count -gt 0) { Start-Sleep -Seconds 2 }
}

function Get-TailscaleStatus {
    param([Parameter(Mandatory=$true)][string]$Exe)

    $result = Invoke-NativeSafe -FilePath $Exe -Arguments @("status", "--json") -AllowFailure
    if ($result.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($result.Text)) { return $null }
    try { return ($result.Text | ConvertFrom-Json) } catch { return $null }
}

function Open-LoginUrlFromText {
    param([string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
    $match = [regex]::Match($Text, "https://[^\s]+")
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

$python = Join-Path $TqsRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
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
        $wingetArgs = @(
            "install",
            "--id", "Tailscale.Tailscale",
            "--exact",
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements"
        )
        Invoke-NativeSafe -FilePath $winget.Source -Arguments $wingetArgs -AllowFailure | Out-Null
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
$status = Get-TailscaleStatus -Exe $tailscale
if (-not $status -or $status.BackendState -ne "Running") {
    $up = Invoke-NativeSafe -FilePath $tailscale -Arguments @("up", "--unattended=true", "--timeout=5s") -AllowFailure
    [void](Open-LoginUrlFromText -Text $up.Text)
    if ($up.ExitCode -ne 0) {
        Write-Host "Complete the one-time Tailscale sign-in in the browser." -ForegroundColor Yellow
    }

    $deadline = (Get-Date).AddMinutes(3)
    do {
        Start-Sleep -Seconds 2
        $status = Get-TailscaleStatus -Exe $tailscale
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
    $opened = Open-LoginUrlFromText -Text $serve.Text
    if ($opened) {
        Write-Host "Approve Tailscale HTTPS/Serve in the browser. Retrying in 8 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 8
        $serve = Invoke-NativeSafe -FilePath $tailscale -Arguments @("serve", "--bg", "--yes", $RemoteTarget) -AllowFailure
    }
}
if ($serve.ExitCode -ne 0) {
    throw "Tailscale Serve setup failed: $($serve.Text)"
}

$status = Get-TailscaleStatus -Exe $tailscale
$dnsName = ""
if ($status -and $status.Self -and $status.Self.DNSName) {
    $dnsName = ([string]$status.Self.DNSName).Trim().TrimEnd(".")
}
$remoteUrl = if ($dnsName) { "https://$dnsName" } else { "" }

Set-EnvValue -Key "TQS_HOST" -Value "127.0.0.1"
Set-EnvValue -Key "TQS_PORT" -Value "8787"
Set-EnvValue -Key "TQS_AUTO_UPDATE" -Value "true"
Set-EnvValue -Key "TQS_SERVER_MODE" -Value "true"
Set-EnvValue -Key "TQS_UPDATE_CHECK_SECONDS" -Value "300"

try {
    Invoke-NativeSafe -FilePath $git -Arguments @("config", "--system", "--add", "safe.directory", $RepoRoot) -AllowFailure | Out-Null
} catch {}

$ownerUser = Resolve-OwnerUser
$node = [ordered]@{
    schema_version = 2
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
    owner_user = $ownerUser
    ai_bridge_task_name = $AiBridgeTaskName
    ai_bridge_interval_seconds = 120
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
$serverArguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $ServerStart + '"'
$serverAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $serverArguments -WorkingDirectory $TqsRoot
$serverTrigger = New-ScheduledTaskTrigger -AtStartup
$serverPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$serverSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue } catch {}
$serverTaskParams = @{
    TaskName = $TaskName
    Action = $serverAction
    Trigger = $serverTrigger
    Principal = $serverPrincipal
    Settings = $serverSettings
    Description = "TQS Intelligence always-on server: auto-start, auto-update and private Tailscale access."
    Force = $true
}
Register-ScheduledTask @serverTaskParams | Out-Null

if (Test-Path $AiBridgeScript) {
    Write-Host "Registering TQS AI Bridge for Google Drive runtime visibility..." -ForegroundColor Yellow
    try {
        if (-not $ownerUser) {
            throw "Could not resolve the interactive Windows owner for AI Bridge task."
        }

        $bridgeArguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $AiBridgeScript + '" -IntervalSeconds 120'
        $bridgeAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $bridgeArguments -WorkingDirectory $TqsRoot
        $bridgeTrigger = New-ScheduledTaskTrigger -AtLogOn -User $ownerUser
        $bridgePrincipal = New-ScheduledTaskPrincipal -UserId $ownerUser -LogonType Interactive -RunLevel Limited
        $bridgeSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

        try { Unregister-ScheduledTask -TaskName $AiBridgeTaskName -Confirm:$false -ErrorAction SilentlyContinue } catch {}
        $bridgeTaskParams = @{
            TaskName = $AiBridgeTaskName
            Action = $bridgeAction
            Trigger = $bridgeTrigger
            Principal = $bridgePrincipal
            Settings = $bridgeSettings
            Description = "TQS sanitized runtime audit to Google Drive for ChatGPT inspection."
            Force = $true
        }
        Register-ScheduledTask @bridgeTaskParams | Out-Null
    } catch {
        Write-Host "AI Bridge task warning: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

if (-not $NoStart) {
    Stop-TqsProcesses
    try { Start-ScheduledTask -TaskName $TaskName } catch {}
}

if (Test-Path $AiBridgeScript) {
    try { Start-ScheduledTask -TaskName $AiBridgeTaskName } catch {}
}

$summaryPath = Join-Path $DataDir "remote-access.txt"
$summary = @(
    "TQS REMOTE NODE",
    "Remote URL: $remoteUrl",
    "Provider: Tailscale Serve (private tailnet only)",
    "Local bind: http://127.0.0.1:8787",
    "Autostart task: $TaskName",
    "AI Bridge task: $AiBridgeTaskName (user logon, every 120 seconds)",
    "Auto-update check: every 300 seconds",
    "Public Funnel: NOT configured by TQS",
    "",
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
if (Test-Path $AiBridgeScript) {
    Write-Host "AI Bridge: enabled at user logon; sanitized audit every 2 minutes to Google Drive when Drive for desktop is mounted." -ForegroundColor Green
}
Write-Host "Security: loopback-only TQS + private Tailscale Serve; no public port opened." -ForegroundColor Green
Write-Host ""
Write-Host "Mac needs one-time Tailscale sign-in to the same account. Then bookmark the Remote URL." -ForegroundColor Cyan
