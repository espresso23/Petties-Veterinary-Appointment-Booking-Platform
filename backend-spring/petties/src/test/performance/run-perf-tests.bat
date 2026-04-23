@echo off
REM Performance Test Runner for Petties Backend
REM Usage: run-perf-tests.bat [env]
REM   env = local (default) | test | prod

set ENV=%1
if "%ENV%"=="" set ENV=local

if "%ENV%"=="local" (
    set BASE_URL=http://localhost:8080
    set OUT_DIR=results\local
) else if "%ENV%"=="test" (
    set BASE_URL=https://api-test.petties.world
    set OUT_DIR=results\test
) else (
    set BASE_URL=https://api.petties.world
    set OUT_DIR=results\prod
)

echo ======================================
echo Petties Performance Tests - %ENV%
echo Target: %BASE_URL%
echo ======================================

mkdir results 2>nul
mkdir %OUT_DIR% 2>nul

echo.
echo [1/3] Running Smoke Test...
k6 run smoke-test.js --env BASE_URL=%BASE_URL% --out json=%OUT_DIR%\smoke-test.json
if errorlevel 1 (
    echo Smoke test FAILED
    exit /b 1
)

echo.
echo [2/3] Running Load Test...
k6 run load-test.js --env BASE_URL=%BASE_URL% --out json=%OUT_DIR%\load-test.json --out html=%OUT_DIR%\load-test-report.html
if errorlevel 1 (
    echo Load test FAILED
    exit /b 1
)

echo.
echo [3/3] Generating summary...
python generate-summary.py %OUT_DIR%

echo.
echo ======================================
echo Test results saved to: %OUT_DIR%\
echo - smoke-test.json
echo - load-test.json
echo - load-test-report.html
echo ======================================
pause