@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0checkpoint.ps1" %*
exit /b %ERRORLEVEL%
