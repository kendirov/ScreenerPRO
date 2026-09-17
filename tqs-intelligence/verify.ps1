$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
& .\.venv\Scripts\python.exe -m pytest -q
& .\.venv\Scripts\python.exe -m compileall -q src
Write-Host "TQS Intelligence v0.3 verification PASS" -ForegroundColor Green
