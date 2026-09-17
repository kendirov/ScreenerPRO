$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
& .\.venv\Scripts\python.exe -m pytest -q
& .\.venv\Scripts\python.exe -m compileall -q src
& .\.venv\Scripts\python.exe -c "from tqs_intelligence.api import app; assert app.version == '0.4.0'; print('API import PASS', app.version)"
if (Get-Command node -ErrorAction SilentlyContinue) {
  node --check .\src\tqs_intelligence\static\app.js
}
Write-Host "TQS Intelligence v0.4 verification PASS" -ForegroundColor Green
