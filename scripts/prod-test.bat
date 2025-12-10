@echo off
REM ============================================
REM PETTIES - Test Production Build Locally
REM Dùng để test trước khi deploy lên Render
REM ============================================

echo.
echo ========================================
echo   PETTIES - Production Test
echo ========================================
echo.
echo [WARNING] This builds production images locally.
echo [WARNING] Uses cloud databases (Neon, MongoDB Atlas, Qdrant Cloud)
echo.

set /p confirm="Continue? (y/n): "
if /i not "%confirm%"=="y" (
    echo Cancelled.
    pause
    exit /b 0
)

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

echo.
echo [INFO] Building production images...
echo.

cd /d %~dp0..
docker-compose -f docker-compose.prod.yml up --build -d

echo.
echo ========================================
echo   Production test running!
echo ========================================
echo.
echo   Backend API:    http://localhost:8080
echo   AI Service:     http://localhost:8000
echo.
echo   View logs:
echo     docker-compose -f docker-compose.prod.yml logs -f
echo.
echo   Stop:
echo     docker-compose -f docker-compose.prod.yml down
echo ========================================
echo.
pause
