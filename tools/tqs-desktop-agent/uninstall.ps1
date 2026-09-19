$ErrorActionPreference = "Stop"
$Root = Join-Path $env:LOCALAPPDATA "TQSDesktopAgent"
Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*TQSDesktopAgent*agent.py*" } |
    ForEach-Object {
        try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
    }
$Shortcut = Join-Path ([Environment]::GetFolderPath("Startup")) "TQS Desktop Agent.lnk"
Remove-Item -Force -ErrorAction SilentlyContinue $Shortcut
Write-Host "Agent stopped and startup shortcut removed."
Write-Host "Data kept at $Root. Delete it manually if you want to remove captures/config."