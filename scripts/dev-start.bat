@echo off
REM ============================================
REM PETTIES Development Startup Script (Windows)
REM Chạy FULL services với Docker (hot-reload)
REM ============================================

echo.
echo ========================================
echo   PETTIES Development Environment
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

echo [INFO] Starting all development services...
echo.

cd /d %~dp0..
docker-compose -f docker-compose.dev.yml up --build -d

echo.
echo Waiting for services to be ready...
timeout /t 15 /nobreak >nul

echo.
echo ========================================
echo   All services are running!
echo ========================================
echo.
echo   PostgreSQL:     localhost:5432
echo   MongoDB:        localhost:27017
echo   Qdrant:         Qdrant Cloud (remote)
echo   Backend API:    http://localhost:8080
echo   AI Service:     http://localhost:8000
echo   Debug Port:     localhost:5005 (Backend)
echo.
echo ========================================
echo   View logs:
echo     docker-compose -f docker-compose.dev.yml logs -f
echo.
echo   Stop all:
echo     .\scripts\dev-stop.bat
echo ========================================
echo.
pause
