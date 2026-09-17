$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path .venv\Scripts\python.exe)) { throw "Run install-windows.ps1 first." }
Start-Process "http://127.0.0.1:8787"
& .\.venv\Scripts\python.exe -m uvicorn tqs_intelligence.api:app --host 127.0.0.1 --port 8787
