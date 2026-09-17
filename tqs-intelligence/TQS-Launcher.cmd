@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\pythonw.exe" (
  echo TQS is not installed yet.
  echo Run install-windows.cmd once.
  pause
  exit /b 1
)
start "TQS Launcher" "./.venv/Scripts/pythonw.exe" -m tqs_intelligence.launcher
exit /b 0
