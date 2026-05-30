@echo off
REM Stop curs5 containers. Pass --purge to also drop volumes (DB data).
setlocal
cd /d "%~dp0"

if /I "%~1"=="--purge" (
  echo [!] Removing containers AND volumes...
  docker compose down -v
) else (
  docker compose down
)
echo [OK] Stopped.
pause
