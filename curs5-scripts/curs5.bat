@echo off
REM ============================================================
REM curs5 - Docker control panel (English only to avoid cmd codepage issues)
REM ============================================================
setlocal EnableExtensions
cd /d "%~dp0"
title curs5 - Docker control panel

where docker >nul 2>&1
if errorlevel 1 (
  echo [X] Docker not found in PATH. Install Docker Desktop and reopen.
  echo.
  pause
  exit /b 1
)

if not exist .env (
  if exist .env.example (
    echo [i] .env not found - copying from .env.example
    copy /Y .env.example .env >nul
  )
)

:MENU
cls
echo ============================================================
echo  curs5 - Docker control panel
echo ============================================================
docker-compose ps 2>nul
echo ============================================================
echo  [1] Start (build + up -d)
echo  [2] Start WITHOUT rebuild
echo  [3] Stop (containers)
echo  [4] Restart backend (after editing .env)
echo  [5] Rebuild backend from scratch (--no-cache)
echo  [6] Logs: backend (Ctrl-C to exit logs)
echo  [7] Logs: ALL services
echo  [8] Status (docker compose ps)
echo  [9] Open app in browser
echo  [M] Open Mailpit in browser
echo  [P] PSQL inside postgres container
echo  [B] Shell inside backend container
echo  [R] PURGE EVERYTHING (down -v, drops DB data!)
echo  [0] Exit
echo ============================================================
set "CHOICE="
set /p "CHOICE=Select: "

if /I "%CHOICE%"=="1" goto UP
if /I "%CHOICE%"=="2" goto START
if /I "%CHOICE%"=="3" goto STOP
if /I "%CHOICE%"=="4" goto RESTART_BACKEND
if /I "%CHOICE%"=="5" goto REBUILD_BACKEND
if /I "%CHOICE%"=="6" goto LOGS_BACKEND
if /I "%CHOICE%"=="7" goto LOGS_ALL
if /I "%CHOICE%"=="8" goto PS
if /I "%CHOICE%"=="9" goto OPEN_APP
if /I "%CHOICE%"=="M" goto OPEN_MAIL
if /I "%CHOICE%"=="P" goto PSQL
if /I "%CHOICE%"=="B" goto BSHELL
if /I "%CHOICE%"=="R" goto PURGE
if /I "%CHOICE%"=="0" goto END
goto MENU

:UP
echo.
echo [*] docker-compose up --build -d
docker-compose up --build -d
echo.
echo [OK] Opening app in 3 sec...
timeout /t 3 >nul
start "" http://localhost:3001/frontend/main-module.html
pause
goto MENU

:START
echo.
echo [*] docker-compose up -d
docker-compose up -d
pause
goto MENU

:STOP
echo.
echo [*] docker-compose down
docker-compose down
pause
goto MENU

:RESTART_BACKEND
echo.
echo [*] docker-compose up -d --force-recreate backend
docker-compose up -d --force-recreate backend
pause
goto MENU

:REBUILD_BACKEND
echo.
echo [*] docker-compose build --no-cache backend
docker-compose build --no-cache backend
echo [*] docker-compose up -d backend
docker-compose up -d backend
pause
goto MENU

:LOGS_BACKEND
echo.
echo [*] Press Ctrl-C to return to menu
docker-compose logs -f --tail=200 backend
goto MENU

:LOGS_ALL
echo.
echo [*] Press Ctrl-C to return to menu
docker-compose logs -f --tail=100
goto MENU

:PS
echo.
docker-compose ps
pause
goto MENU

:OPEN_APP
start "" http://localhost:3001/frontend/main-module.html
goto MENU

:OPEN_MAIL
start "" http://localhost:8025
goto MENU

:PSQL
echo.
echo [i] Type \q to exit psql
set "DBN=curs5"
set "DBU=curs5"
if exist .env (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /I "%%A"=="DB_NAME" set "DBN=%%B"
    if /I "%%A"=="DB_USER" set "DBU=%%B"
  )
)
docker-compose exec postgres psql -U %DBU% -d %DBN%
goto MENU

:BSHELL
echo.
echo [i] Type exit to leave the shell
docker-compose exec backend sh
goto MENU

:PURGE
echo.
echo [!] WARNING: this will delete volumes (DB, Redis, logs).
set "OK="
set /p "OK=Really wipe everything? (y/N): "
if /I not "%OK%"=="y" goto MENU
docker-compose down -v
echo [OK] Wiped.
pause
goto MENU

:END
endlocal
exit /b 0