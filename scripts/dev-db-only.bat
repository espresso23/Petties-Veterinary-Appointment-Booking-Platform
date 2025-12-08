@echo off
REM ============================================
REM PETTIES - Start DATABASES ONLY
REM Dùng khi muốn chạy Backend/AI Service trực tiếp
REM (không qua Docker) để debug hoặc dev nhanh hơn
REM ============================================

echo.
echo ========================================
echo   PETTIES - Databases Only Mode
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

echo [INFO] Starting databases only...
echo.

cd /d %~dp0..
docker-compose -f docker-compose.db-only.yml up -d

echo.
echo Waiting for databases to be healthy...
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo   Databases are running!
echo ========================================
echo.
echo   PostgreSQL: localhost:5432
echo   MongoDB:    localhost:27017
echo   Qdrant:     Qdrant Cloud (use QDRANT_URL env var)
echo.
echo ========================================
echo   Now start services manually:
echo ========================================
echo.
echo   Backend (Spring Boot):
echo     cd backend-spring\petties
echo     mvn spring-boot:run
echo.
echo   AI Service (FastAPI):
echo     cd petties-agent-serivce
echo     python -m uvicorn app.main:app --reload --port 8000
echo.
echo   Frontend (React):
echo     cd petties-web
echo     npm run dev
echo.
echo ========================================
echo.
pause
