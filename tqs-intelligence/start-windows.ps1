$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path .venv\Scripts\python.exe)) { throw "Run install-windows.ps1 first." }
& .\.venv\Scripts\python.exe -m tqs_intelligence.supervisor
