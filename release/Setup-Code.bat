@echo off
cd /d "%~dp0"
if not exist "data\.setup-token" (
  echo First run Start-Dal.bat and wait until it starts. Then run this file again.
  pause
  exit /b 1
)
notepad "data\.setup-token"
