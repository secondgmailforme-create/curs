@echo off
REM Same as up.bat - kept for backward compatibility.
setlocal
cd /d "%~dp0"

where docker >nul 2>&1
if errorlevel 1 (
  echo [X] Docker not found in PATH. Install Docker Desktop.
  pause
  exit /b 1
)

if not exist .env (
  if exist .env.example (
    echo [i] .env not found - copying from .env.example
    copy /Y .env.example .env >nul
  )
)

echo [*] Building images...
docker compose build || goto :err

echo [*] Starting containers...
docker compose up -d || goto :err

echo.
echo [OK] Status:
docker compose ps

echo.
echo Open in browser:
echo   http://localhost:3001/frontend/main-module.html
echo.
echo Logs:  docker compose logs -f backend
echo Stop:  stop.bat
pause
exit /b 0

:err
echo [X] docker compose failed.
pause
exit /b 1
