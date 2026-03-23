@echo off
setlocal
cd /d "%~dp0"
cd /d "%~dp0frontend"

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] pnpm not found. Install with: npm install -g pnpm
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] Installing dependencies...
  call pnpm install
  if errorlevel 1 (
    echo [ERROR] pnpm install failed.
    pause
    exit /b 1
  )
)

echo [INFO] Starting Super Screener on http://localhost:3000
call pnpm dev

endlocal
