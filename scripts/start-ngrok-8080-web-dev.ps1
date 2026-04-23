#Requires -Version 5.1
<#
.SYNOPSIS
    Chay ngrok cho port 8080 va chay web dev server (Vite) cho petties-web.
.DESCRIPTION
    Script nay danh cho nguoi dung chay trong PowerShell (Windows).
    - Start `ngrok http 8080` (ghi log ra file)
    - Doc public URL tu ngrok API (http://127.0.0.1:4040)
    - Export tam thoi `VITE_NGROK_HOST` roi chay `npm run dev` trong `petties-web`
.EXAMPLE
    .\scripts\start-ngrok-8080-web-dev.ps1
.PARAMETER NgrokApiUrl
    URL ngrok local API (mac dinh: http://127.0.0.1:4040/api/tunnels)
.PARAMETER NgrokLogFile
    File log stdout ngrok (mac dinh: %TEMP%\petties-ngrok-8080.log)
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$NgrokApiUrl = "http://127.0.0.1:4040/api/tunnels",

    [Parameter(Mandatory = $false)]
    [string]$NgrokLogFile = (Join-Path $env:TEMP "petties-ngrok-8080.log")
)

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message)
    Write-Host "[dev-ngrok-web] $Message"
}

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Thieu command: $Name"
    }
}

function Get-NgrokDomainFromApi {
    param([string]$ApiUrl)

    $data = Invoke-RestMethod -Method Get -Uri $ApiUrl -TimeoutSec 2
    if (-not $data -or -not $data.tunnels) {
        return $null
    }

    $tunnel = $data.tunnels | Where-Object {
        $_.config -and $_.config.addr -and ($_.config.addr -in @("http://localhost:8080", "localhost:8080", "8080"))
    } | Select-Object -First 1

    if (-not $tunnel -or -not $tunnel.public_url) {
        return $null
    }

    return ($tunnel.public_url -replace '^https?://', '')
}

$RepoDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$WebDir = Join-Path $RepoDir "petties-web"
if (-not (Test-Path $WebDir)) {
    throw "Khong tim thay thu muc: $WebDir"
}

Require-Command "ngrok"
Require-Command "npm"

$NgrokErrLogFile = $null
if ($NgrokLogFile.ToLowerInvariant().EndsWith(".log")) {
    $NgrokErrLogFile = $NgrokLogFile.Substring(0, $NgrokLogFile.Length - 4) + ".err.log"
} else {
    $NgrokErrLogFile = $NgrokLogFile + ".err"
}

$ngrokProc = $null
try {
    Write-Log "Chay ngrok cho port 8080..."
    Write-Log "Ngrok log stdout: $NgrokLogFile"
    Write-Log "Ngrok log stderr: $NgrokErrLogFile"
    $ngrokProc = Start-Process -FilePath "ngrok" -ArgumentList @("http", "8080", "--log=stdout", "--log-format=logfmt") -RedirectStandardOutput $NgrokLogFile -RedirectStandardError $NgrokErrLogFile -WindowStyle Hidden -PassThru
    Write-Log "Ngrok PID: $($ngrokProc.Id)"
    Write-Log "Ngrok dashboard (local): http://127.0.0.1:4040"

    $domain = $null
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $domain = Get-NgrokDomainFromApi -ApiUrl $NgrokApiUrl
        } catch {
            $domain = $null
        }

        if ($domain) { break }
        Start-Sleep -Milliseconds 500
    }

    if ($domain) {
        Write-Log "Ngrok public URL: https://$domain"
        $env:VITE_NGROK_HOST = $domain
        Write-Log "Da set tam VITE_NGROK_HOST=$domain cho phien PowerShell nay."
    } else {
        Write-Log "Khong lay duoc public URL tu ngrok API ($NgrokApiUrl). Ban xem trong ngrok dashboard/terminal."
    }

    Write-Log "Chay Web dev server..."
    Push-Location $WebDir
    try {
        npm run dev
    } finally {
        Pop-Location
    }
}
finally {
    if ($ngrokProc -and -not $ngrokProc.HasExited) {
        Write-Log "Dung ngrok (PID $($ngrokProc.Id))..."
        Stop-Process -Id $ngrokProc.Id -Force -ErrorAction SilentlyContinue
    }
}
