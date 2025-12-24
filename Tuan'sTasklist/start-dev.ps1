# Frontend Development Server Starter
# Bypass execution policy for this script only

# Get the directory where this script is located
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "🚀 Starting Frontend Development Server..." -ForegroundColor Green
Write-Host "📁 Directory: $scriptDir" -ForegroundColor Cyan
Write-Host ""

# Try to use npm.cmd if available, otherwise use npm with bypass
$npmPath = Get-Command npm -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source

if ($npmPath -like "*.cmd") {
    Write-Host "✅ Using npm.cmd" -ForegroundColor Green
    & npm.cmd run dev
} elseif ($npmPath -like "*.ps1") {
    Write-Host "⚠️  npm.ps1 detected, using bypass..." -ForegroundColor Yellow
    powershell.exe -ExecutionPolicy Bypass -NoProfile -File -Command "cd '$scriptDir'; npm run dev"
} else {
    Write-Host "✅ Using npm directly" -ForegroundColor Green
    npm run dev
}

