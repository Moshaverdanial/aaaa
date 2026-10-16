@echo off
cd /d "%~dp0"
node dal.js backup
echo.
echo Done. Also copy the whole "data" folder to a USB drive or another safe place.
pause
