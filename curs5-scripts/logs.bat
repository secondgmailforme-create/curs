@echo off
REM Tail backend logs. Press Ctrl-C to exit.
setlocal
cd /d "%~dp0"
docker compose logs -f --tail=200 backend
exit /b 0
