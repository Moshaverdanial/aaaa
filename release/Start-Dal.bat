@echo off
cd /d "%~dp0"
title Dal Server - do not close this window
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening the download page...
  start https://nodejs.org
  pause
  exit /b 1
)
echo Starting Dal. Keep this window open. The browser will open in a few seconds.
start "" /min cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"
node dal.js
pause
