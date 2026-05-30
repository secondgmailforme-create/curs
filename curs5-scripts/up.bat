@echo off
REM Quick start: build + up -d + open app in browser.
setlocal
cd /d "%~dp0"

if not exist .env (
  if exist .env.example copy /Y .env.example .env >nul
)

docker compose up --build -d
if errorlevel 1 (
  echo [X] docker compose up failed
  pause
  exit /b 1
)

echo.
docker compose ps
echo.
echo [OK] Opening http://localhost:3001/frontend/main-module.html
start "" http://localhost:3001/frontend/main-module.html
exit /b 0
