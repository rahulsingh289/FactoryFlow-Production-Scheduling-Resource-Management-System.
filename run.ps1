# Smart Factory Production Scheduler - Unified Run Script (Windows)
# This script compiles the C++ backend, installs frontend dependencies, and runs everything

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Smart Factory Production Scheduler" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Get the directory where the script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Step 1: Compile C++ Backend
Write-Host "[1/4] Compiling C++ backend..." -ForegroundColor Yellow
$compileCmd = "g++ -std=c++17 -Ibackend/include backend/src/main.cpp backend/src/scheduler.cpp backend/src/resource_manager.cpp backend/src/bankers.cpp -o scheduler.exe"

try {
    Invoke-Expression $compileCmd
    Write-Host "✓ Backend compiled successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend compilation failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Install Frontend Dependencies (if needed)
Write-Host "[2/4] Checking frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend

if (-Not (Test-Path "node_modules") -or -Not (Test-Path "node_modules/.bin/vite")) {
    Write-Host "Installing npm packages..." -ForegroundColor Yellow
    if (Test-Path "node_modules") { Remove-Item -Recurse -Force node_modules }
    if (Test-Path "package-lock.json") { Remove-Item -Force package-lock.json }
    npm install
    Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✓ Frontend dependencies already installed" -ForegroundColor Green
}
Set-Location ..
Write-Host ""

# Step 3: Run C++ Scheduler
Write-Host "[3/4] Running C++ scheduler..." -ForegroundColor Yellow
Write-Host "-----------------------------------" -ForegroundColor Gray
.\scheduler.exe
Write-Host "-----------------------------------" -ForegroundColor Gray
Write-Host "✓ Scheduler execution completed" -ForegroundColor Green
Write-Host ""

# Step 4: Start Frontend Development Server
Write-Host "[4/4] Starting React dashboard..." -ForegroundColor Yellow
Write-Host "-----------------------------------" -ForegroundColor Gray
Write-Host "Opening http://localhost:3000 in your browser..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Cyan
Write-Host "-----------------------------------" -ForegroundColor Gray

# Open browser
Start-Process "http://localhost:3000"

# Start dev server
Set-Location frontend
npm run dev
