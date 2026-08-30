@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1" %*
if errorlevel 1 (
  echo.
  echo Setup failed. Copy the error above and send it to Codex.
  pause
  exit /b 1
)
echo.
echo Setup complete. You can now use $talk-to-publish-cn in Codex.
pause
