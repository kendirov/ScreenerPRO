@echo off
setlocal
cd /d "%~dp0"
call "%~dp0run-dev-full.cmd"
exit /b %ERRORLEVEL%
