param(
    [switch]$NoStart
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Source = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Join-Path $env:LOCALAPPDATA "TQSDesktopAgent"
$App = Join-Path $Root "app"
$Venv = Join-Path $Root "venv"
$Python = Join-Path $Venv "Scripts\python.exe"
$PythonW = Join-Path $Venv "Scripts\pythonw.exe"

Write-Host "Installing TQS Desktop Agent..."
New-Item -ItemType Directory -Force -Path $Root, $App | Out-Null
Copy-Item -Force (Join-Path $Source "agent.py") $App
Copy-Item -Force (Join-Path $Source "client.py") $App
Copy-Item -Force (Join-Path $Source "requirements.txt") $App

if (-not (Test-Path $Python)) {
    python -m venv $Venv
}
& $Python -m pip install --disable-pip-version-check --quiet -r (Join-Path $App "requirements.txt")

Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*TQSDesktopAgent*agent.py*" } |
    ForEach-Object {
        try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
    }

$Startup = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $Startup "TQS Desktop Agent.lnk"
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $PythonW
$Shortcut.Arguments = '"' + (Join-Path $App "agent.py") + '"'
$Shortcut.WorkingDirectory = $App
$Shortcut.Description = "TQS Desktop Agent - local eyes and hands bridge"
$Shortcut.Save()
if (-not $NoStart) {
    Start-Process -FilePath $PythonW -ArgumentList ('"' + (Join-Path $App "agent.py") + '"') -WorkingDirectory $App
    Start-Sleep -Seconds 4
    & $Python (Join-Path $App "client.py") health
}
Write-Host "Installed at: $Root"
Write-Host "Startup shortcut: $ShortcutPath"