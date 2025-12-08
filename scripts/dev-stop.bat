@echo off
REM ============================================
REM PETTIES Development Stop Script (Windows)
REM ============================================

echo.
echo Stopping all Petties development services...
echo.

cd /d %~dp0..
docker-compose -f docker-compose.dev.yml down

echo.
echo All services stopped.
echo.
pause
