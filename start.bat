@echo off
setlocal EnableDelayedExpansion
title AquaTrace - Launching...
color 0B

REM ============================================================
REM  AquaTrace - One-Click Launcher
REM  Double-click this file and the website opens automatically.
REM  To stop: run stop.bat or close the backend/frontend windows.
REM ============================================================

REM --- Resolve project root (works from any location) ---
pushd "%~dp0"
if exist "backend\app.py" (
    set "ROOT=%CD%"
) else if exist "my-oxy-folder\backend\app.py" (
    set "ROOT=%CD%\my-oxy-folder"
) else (
    echo [ERROR] Could not find backend\app.py — are you in the right folder?
    pause
    exit /b 1
)
popd

cls
echo.
echo   ╔══════════════════════════════════════════════════════════╗
echo   ║         AQUATRACE - SMART WATER QUALITY MONITOR         ║
echo   ║              One-Click Launcher v2.0                    ║
echo   ╚══════════════════════════════════════════════════════════╝
echo.

REM ────────────────────────────────────────────────────────────
REM  STEP 1: Verify Python + Node.js are installed
REM ────────────────────────────────────────────────────────────
echo   [1/6] Checking prerequisites...

where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo   [ERROR] Python not found!
    echo   Install Python 3.10+: https://www.python.org/downloads/
    echo   Make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo   [ERROR] Node.js not found!
    echo   Install Node.js v18+: https://nodejs.org/
    pause
    exit /b 1
)
echo   [OK] Python and Node.js found.

REM ────────────────────────────────────────────────────────────
REM  STEP 2: Setup Python virtual environment + install deps
REM ────────────────────────────────────────────────────────────
echo   [2/6] Setting up Python environment...

if not exist "!ROOT!\backend\venv\Scripts\python.exe" (
    echo          Creating virtual environment...
    python -m venv "!ROOT!\backend\venv"
    if %ERRORLEVEL% neq 0 (
        echo   [ERROR] Failed to create Python venv.
        pause
        exit /b 1
    )
)

REM Always ensure pip deps are up to date (fast if already installed)
echo          Installing Python dependencies...
"!ROOT!\backend\venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check -r "!ROOT!\backend\requirements.txt" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [WARN] pip install had issues — trying verbose...
    "!ROOT!\backend\venv\Scripts\python.exe" -m pip install -r "!ROOT!\backend\requirements.txt"
    if %ERRORLEVEL% neq 0 (
        echo   [ERROR] Failed to install Python dependencies.
        pause
        exit /b 1
    )
)
echo   [OK] Python environment ready.

REM ────────────────────────────────────────────────────────────
REM  STEP 3: Setup backend .env if missing
REM ────────────────────────────────────────────────────────────
echo   [3/6] Preparing configuration...

if not exist "!ROOT!\backend\.env" (
    if exist "!ROOT!\backend\.env.example" (
        copy "!ROOT!\backend\.env.example" "!ROOT!\backend\.env" >nul
        echo          Created .env from .env.example
    )
)
echo   [OK] Configuration ready.

REM ────────────────────────────────────────────────────────────
REM  STEP 4: Install frontend npm packages if needed
REM ────────────────────────────────────────────────────────────
echo   [4/6] Checking frontend dependencies...

if not exist "!ROOT!\frontend\node_modules\package.json" (
    if not exist "!ROOT!\frontend\node_modules\.package-lock.json" (
        echo          Installing npm packages (first run — may take a minute)...
        cd /d "!ROOT!\frontend"
        call npm.cmd install --loglevel=error
        if %ERRORLEVEL% neq 0 (
            echo   [ERROR] npm install failed.
            pause
            exit /b 1
        )
    )
)
echo   [OK] Frontend packages ready.

REM ────────────────────────────────────────────────────────────
REM  STEP 5: Kill any stale AquaTrace processes
REM ────────────────────────────────────────────────────────────
echo   [5/6] Cleaning up old processes...
taskkill /f /t /fi "WINDOWTITLE eq AquaTrace - Backend*" >nul 2>&1
taskkill /f /t /fi "WINDOWTITLE eq AquaTrace - Frontend*" >nul 2>&1

REM ────────────────────────────────────────────────────────────
REM  STEP 6: Launch backend + frontend + open browser
REM ────────────────────────────────────────────────────────────
echo   [6/6] Starting servers...

REM --- Start Backend (minimized) ---
start /min "AquaTrace - Backend" cmd /c "title AquaTrace - Backend && cd /d "!ROOT!\backend" && "!ROOT!\backend\venv\Scripts\python.exe" app.py"

REM --- Start Frontend (minimized) ---
start /min "AquaTrace - Frontend" cmd /c "title AquaTrace - Frontend && cd /d "!ROOT!\frontend" && npm.cmd run dev"

echo.
echo   Waiting for backend to come online...

REM --- Wait for backend to respond (up to 30 seconds) ---
set "READY=0"
for /L %%i in (1,1,30) do (
    if !READY! equ 0 (
        >nul 2>&1 curl -sf http://127.0.0.1:5000/api/health
        if !ERRORLEVEL! equ 0 (
            set "READY=1"
        ) else (
            >nul 2>&1 timeout /t 1 /nobreak
        )
    )
)

if !READY! equ 0 (
    echo   [WARN] Backend didn't respond in 30s — opening browser anyway.
    REM Give frontend a moment too
    timeout /t 3 /nobreak >nul 2>&1
)

REM --- Wait briefly for Vite to be ready ---
timeout /t 2 /nobreak >nul 2>&1

REM --- Detect which port Vite chose ---
set "PORT=5173"
>nul 2>&1 curl -sf http://localhost:5173
if %ERRORLEVEL% neq 0 (
    >nul 2>&1 curl -sf http://localhost:5174
    if %ERRORLEVEL% equ 0 set "PORT=5174"
)

REM --- Open the dashboard ---
start http://localhost:!PORT!

echo.
echo   ╔══════════════════════════════════════════════════════════╗
echo   ║              AQUATRACE IS NOW RUNNING!                  ║
echo   ╠══════════════════════════════════════════════════════════╣
echo   ║                                                        ║
echo   ║   Frontend:  http://localhost:!PORT!                    ║
echo   ║   Backend:   http://127.0.0.1:5000                     ║
echo   ║   ESP32 API: http://127.0.0.1:5000/api/reading         ║
echo   ║                                                        ║
echo   ║   To stop: close this window or run stop.bat           ║
echo   ║                                                        ║
echo   ╚══════════════════════════════════════════════════════════╝
echo.
echo   Press any key to stop all servers and exit...
pause >nul

REM --- Cleanup on exit ---
echo.
echo   Shutting down AquaTrace...
taskkill /f /t /fi "WINDOWTITLE eq AquaTrace - Backend*" >nul 2>&1
taskkill /f /t /fi "WINDOWTITLE eq AquaTrace - Frontend*" >nul 2>&1
echo   Done. Goodbye!
timeout /t 2 /nobreak >nul 2>&1
exit /b 0
