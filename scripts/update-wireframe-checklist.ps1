#Requires -Version 5.1
<#
.SYNOPSIS
    Update WIREFRAME_CHECKLIST.md with new Stitch wireframe ID
.DESCRIPTION
    This script updates the wireframe checklist with new Stitch ID after generation.
    Can be called manually or by Antigravity after successful Stitch generation.
.EXAMPLE
    .\update-wireframe-checklist.ps1 -Screen "Pet Detail Screen" -StitchId "abc123..."
.EXAMPLE
    .\update-wireframe-checklist.ps1 -Screen "Pet Detail Screen" -StitchId "abc123..." -Type design
.NOTES
    File Name      : update-wireframe-checklist.ps1
    Author         : Petties Dev Team
    Location       : scripts/
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Screen,
    
    [Parameter(Mandatory=$true)]
    [string]$StitchId,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("wireframe", "design")]
    [string]$Type = "wireframe",
    
    [Parameter(Mandatory=$false)]
    [string]$ChecklistPath = "docs-references/documentation/SRS/WIREFRAME_CHECKLIST.md"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Wireframe Checklist Updater" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if checklist file exists
if (-not (Test-Path $ChecklistPath)) {
    Write-Host "❌ Error: Checklist file not found at $ChecklistPath" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Loading checklist: $ChecklistPath" -ForegroundColor Gray

# Read current content
$content = Get-Content $ChecklistPath -Raw

# Find the screen in checklist
$escapedScreen = [regex]::Escape($Screen)
$pattern = "(?m)^(- \[[ -]\]) \*\*$escapedScreen\*\*"

if ($content -match $pattern) {
    Write-Host "✅ Found screen: $Screen" -ForegroundColor Green
    
    # Check if already completed
    $completedPattern = "(?m)^(- \[x\]) \*\*$escapedScreen\*\*"
    if ($content -match $completedPattern) {
        Write-Host "ℹ️  Screen already marked as completed" -ForegroundColor Yellow
        
        # Check if need to update Design ID
        if ($Type -eq "design") {
            $designPattern = "(?m)(- \[x\] \*\*$escapedScreen\*\*.*?)(Stitch ID: `.*?`)"
            if ($content -match $designPattern) {
                $currentId = $Matches[2]
                Write-Host "   Current Wireframe ID: $currentId" -ForegroundColor Gray
                
                # Add Design ID
                $newContent = $content -replace 
                    "(?m)(- \[x\] \*\*$escapedScreen\*\*.*?)\n  - Stitch ID:",
                    "`$1`n  - Wireframe Stitch ID:"
                
                $newContent = $newContent -replace 
                    "(?m)(- \[x\] \*\*$escapedScreen\*\*.*?)\n  - Code:",
                    "`$1`n  - Design Stitch ID: `$StitchId`n  - Code:"
                
                Set-Content -Path $ChecklistPath -Value $newContent
                Write-Host "✅ Added Design Stitch ID: $StitchId" -ForegroundColor Green
            }
        }
    } else {
        # Mark as completed and add Stitch ID
        $newContent = $content -replace 
            "(?m)^(- \[ \]) \*\*$escapedScreen\*\*",
            "- [x] **$Screen**"
        
        # Add Stitch ID after screen name
        $newContent = $newContent -replace 
            "(?m)(- \[x\] \*\*$escapedScreen\*\*.*?)(\n  - Code:)",
            "`$1`n  - Stitch ID: `$StitchId`$2"
        
        Set-Content -Path $ChecklistPath -Value $newContent
        Write-Host "✅ Updated checklist:" -ForegroundColor Green
        Write-Host "   Screen: $Screen" -ForegroundColor White
        Write-Host "   Status: Completed" -ForegroundColor White
        Write-Host "   Stitch ID: $StitchId" -ForegroundColor White
    }
} else {
    Write-Host "❌ Screen not found: $Screen" -ForegroundColor Red
    Write-Host "   Available screens in checklist:" -ForegroundColor Yellow
    
    # List all screens
    $screens = $content | Select-String -Pattern "^- \[.\] \*\*(.+?)\*\*" -AllMatches
    $screens.Matches | ForEach-Object {
        Write-Host "   - $($_.Groups[1].Value)" -ForegroundColor Gray
    }
    
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Checklist updated successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
if ($Type -eq "wireframe") {
    Write-Host "  1. Review wireframe in Stitch" -ForegroundColor White
    Write-Host "  2. Generate full-color design: @petties-stitch-design" -ForegroundColor White
    Write-Host "  3. Update with Design ID: -Type design" -ForegroundColor White
} else {
    Write-Host "  1. Review full-color design" -ForegroundColor White
    Write-Host "  2. Implement code with: @petties-flutter or @petties-web-frontend" -ForegroundColor White
}
