@echo off
REM Stop the stack. Pass --purge to also delete volumes.
setlocal
cd /d "%~dp0"

if /I "%~1"=="--purge" (
  echo [!] Removing containers AND volumes...
  docker compose down -v
) else (
  docker compose down
)
echo [OK] Stopped.
exit /b 0
