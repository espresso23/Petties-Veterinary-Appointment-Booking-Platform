#Requires -Version 5.1
<#
.SYNOPSIS
    Auto-update ngrok URLs in mobile .env file for nginx reverse proxy setup
.DESCRIPTION
    This script fetches ngrok tunnel URLs and updates the mobile .env file automatically.
    
    With nginx reverse proxy setup:
    - Only 1 ngrok tunnel needed (port 8080 for nginx)
    - Nginx routes traffic to both Backend and AI Service:
      * /api/*      -> Backend:8080
      * /ws/chat/*  -> AI Service:8000 (WebSocket)
      * /ws/*       -> Backend:8080 (WebSocket)
      * /*          -> AI Service:8000 (REST API)
    
    Run this after starting ngrok tunnel.
.EXAMPLE
    .\update-ngrok-env.ps1
.EXAMPLE
    .\update-ngrok-env.ps1 -Verbose
.NOTES
    File Name      : update-ngrok-env.ps1
    Author         : Petties Dev Team
    Prerequisite   : PowerShell 5.1 or later, ngrok running on port 4040
    Setup          : docker-compose -f docker-compose.dev.yml up -d nginx
                     ngrok http 8080
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ngrok Environment Updater" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ngrok API endpoint (default ngrok web interface)
$ngrokApi = "http://127.0.0.1:4040/api/tunnels"

# Mobile .env file path
$mobileEnvPath = "petties_mobile/.env"

# Check if ngrok is running
try {
    $response = Invoke-RestMethod -Uri $ngrokApi -TimeoutSec 5
    Write-Host "✅ Ngrok is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Cannot connect to ngrok API at $ngrokApi" -ForegroundColor Red
    Write-Host "   Make sure ngrok is running first:" -ForegroundColor Yellow
    Write-Host "   ngrok http 8080" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Extract tunnel URLs
$tunnels = $response.tunnels

if (-not $tunnels -or $tunnels.Count -eq 0) {
    Write-Host "❌ Error: No ngrok tunnels found" -ForegroundColor Red
    Write-Host "   Start ngrok first:" -ForegroundColor Yellow
    Write-Host "   ngrok http 8080" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "Found tunnels:" -ForegroundColor Cyan
foreach ($tunnel in $tunnels) {
    Write-Host "  - $($tunnel.name): $($tunnel.public_url) -> $($tunnel.config.addr)" -ForegroundColor Gray
}
Write-Host ""

# With nginx reverse proxy, we only need 1 tunnel (port 8080)
# Nginx routes: /api/* -> backend:8080, /ws/chat/* -> ai-service:8000, /* -> ai-service:8000
$ngrokUrl = $tunnels | Where-Object { 
    $_.config.addr -eq "localhost:8080" -or 
    $_.config.addr -eq "127.0.0.1:8080" -or
    $_.config.addr -eq "http://localhost:8080"
} | Select-Object -ExpandProperty public_url -First 1

# Check if we found the URL
if (-not $ngrokUrl) {
    Write-Host "⚠️ Warning: Ngrok tunnel for port 8080 (nginx) not found" -ForegroundColor Yellow
    Write-Host "   Start ngrok tunnel:" -ForegroundColor Yellow
    Write-Host "   ngrok http 8080" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Note: With nginx reverse proxy, you only need 1 tunnel for port 8080" -ForegroundColor Gray
    Write-Host "   Nginx will route traffic to both Backend and AI Service" -ForegroundColor Gray
}

# Read current .env file
if (-not (Test-Path $mobileEnvPath)) {
    Write-Host "❌ Error: .env file not found at $mobileEnvPath" -ForegroundColor Red
    Write-Host "   Make sure you're running from the project root" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$content = Get-Content $mobileEnvPath -Raw

# Show current values
Write-Host "Current configuration:" -ForegroundColor Cyan
if ($content -match "API_BASE_URL=(.+)") {
    Write-Host "  API_BASE_URL: $($Matches[1])" -ForegroundColor Gray
}
if ($content -match "AI_SERVICE_URL=(.+)") {
    Write-Host "  AI_SERVICE_URL: $($Matches[1])" -ForegroundColor Gray
}
if ($content -match "WS_URL=(.+)") {
    Write-Host "  WS_URL: $($Matches[1])" -ForegroundColor Gray
}
Write-Host ""

# Update API_BASE_URL and related configs
if ($ngrokUrl) {
    # Convert to https if needed
    $baseUrl = $ngrokUrl -replace "http://", "https://"
    $wsUrl = $baseUrl -replace "https://", "wss://"
    
    # Update API_BASE_URL
    if ($content -match "^API_BASE_URL=.*$") {
        $content = $content -replace "^API_BASE_URL=.*$", "API_BASE_URL=$baseUrl"
        Write-Host "✅ Updated API_BASE_URL to: $baseUrl" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Warning: API_BASE_URL not found in .env, adding it" -ForegroundColor Yellow
        $content += "`nAPI_BASE_URL=$baseUrl"
    }
    
    # Update AI_SERVICE_URL (clear it for auto-detect, since nginx routes everything)
    if ($content -match "^AI_SERVICE_URL=.*$") {
        $content = $content -replace "^AI_SERVICE_URL=.*$", "AI_SERVICE_URL="
        Write-Host "✅ Cleared AI_SERVICE_URL (auto-detect from API_BASE_URL)" -ForegroundColor Green
    }
    
    # Update WS_URL for WebSocket
    if ($content -match "^WS_URL=.*$") {
        $content = $content -replace "^WS_URL=.*$", "WS_URL=$wsUrl"
        Write-Host "✅ Updated WS_URL to: $wsUrl" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Warning: WS_URL not found in .env, adding it" -ForegroundColor Yellow
        $content += "`nWS_URL=$wsUrl"
    }
    
    Write-Host ""
    Write-Host "ℹ️  Note: With nginx reverse proxy, Backend and AI Service share the same URL:" -ForegroundColor Cyan
    Write-Host "   - REST API: $baseUrl/api/..." -ForegroundColor Gray
    Write-Host "   - AI Service: $baseUrl/..." -ForegroundColor Gray
    Write-Host "   - WebSocket: $wsUrl/ws/..." -ForegroundColor Gray
}

# Save the file
Set-Content -Path $mobileEnvPath -Value $content -NoNewline
Add-Content -Path $mobileEnvPath -Value ""  # Ensure file ends with newline

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ .env file updated successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. cd petties_mobile" -ForegroundColor White
Write-Host "  2. flutter clean" -ForegroundColor White
Write-Host "  3. flutter pub get" -ForegroundColor White
Write-Host "  4. flutter run" -ForegroundColor White
Write-Host ""

# Optional: Show current .env content
$showContent = Read-Host "Show updated .env content? (y/N)"
if ($showContent -eq 'y' -or $showContent -eq 'Y') {
    Write-Host ""
    Write-Host "Updated .env content:" -ForegroundColor Cyan
    Write-Host "----------------------------------------" -ForegroundColor Gray
    Get-Content $mobileEnvPath | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
    Write-Host "----------------------------------------" -ForegroundColor Gray
    Write-Host ""
}
