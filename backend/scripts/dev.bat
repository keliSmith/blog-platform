@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================
REM Blog Platform - Backend Dev Startup (FastAPI, Windows)
REM ============================================

echo === Blog Platform Backend (FastAPI) ===

REM 1. Check Python
echo [1/5] Checking Python...
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Python not found. Please install Python 3.10+ from https://www.python.org/downloads/
    exit /b 1
)
python --version

REM 2. Create virtual environment (backend/venv) if needed
echo [2/5] Setting up virtual environment...
if not exist "venv" (
    echo Creating virtual environment (venv)...
    python -m venv venv
)
call venv\Scripts\activate.bat
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to activate virtual environment
    exit /b 1
)

REM 3. Install dependencies
echo [3/5] Installing dependencies...
python -m pip install --upgrade pip -q
pip install -e ".[dev]" -q

REM 4. Prepare configuration
echo [4/5] Preparing configuration...
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo Created .env from .env.example
    )
)

REM Optional: MySQL/Redis via docker-compose
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    docker info >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo Starting MySQL/Redis from docker-compose...
        cd /d "%~dp0..\.."
        docker compose up -d mysql redis 2>nul || echo Could not start docker services (continuing with SQLite).
        cd /d "%~dp0.."
        mysql -u root -p123456 -h 127.0.0.1 blog < migrations\init.sql 2>nul || ver >nul
        alembic upgrade head 2>nul || echo Skipped Alembic (dev uses auto-created tables).
    ) else (
        echo Docker not running - using SQLite (tables auto-created on startup).
    )
) else (
    echo Docker not found - using SQLite (tables auto-created on startup).
)

REM 5. Start FastAPI dev server
echo.
echo === Starting FastAPI Dev Server on http://localhost:8000 ===
echo API docs: http://localhost:8000/docs
set APP_ENV=development
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

endlocal
