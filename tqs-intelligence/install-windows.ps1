$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw "Python 3.12+ not found. Install Python from python.org and enable the launcher." }
if (-not (Test-Path .venv)) { py -3.12 -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -e ".[dev,analytics]"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Write-Host "TQS Intelligence installed. Run start-windows.ps1" -ForegroundColor Green
