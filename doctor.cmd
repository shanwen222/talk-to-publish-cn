@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\doctor.ps1" %*
if errorlevel 1 (
  echo.
  echo Environment is not ready. Run setup.cmd and try again.
  pause
  exit /b 1
)
pause
