@echo off
REM Recreate only the backend container (e.g. after editing .env).
setlocal
cd /d "%~dp0"
docker compose up -d --force-recreate backend
echo [OK] backend restarted.
exit /b 0
