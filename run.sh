#!/bin/bash

# Smart Factory Production Scheduler - Unified Run Script
# This script compiles the C++ backend, installs frontend dependencies, and runs everything

set -e  # Exit on error

echo "=================================="
echo "Smart Factory Production Scheduler"
echo "=================================="
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Step 1: Compile C++ Backend
echo "[1/4] Compiling C++ backend..."
g++ -std=c++17 -Ibackend/include \
    backend/src/main.cpp \
    backend/src/scheduler.cpp \
    backend/src/resource_manager.cpp \
    backend/src/bankers.cpp \
    -o scheduler

if [ $? -eq 0 ]; then
    echo "✓ Backend compiled successfully"
else
    echo "✗ Backend compilation failed"
    exit 1
fi
echo ""

# Step 2: Install Frontend Dependencies (if needed)
echo "[2/4] Checking frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/vite" ]; then
    echo "Installing npm packages..."
    rm -rf node_modules package-lock.json
    npm install
    echo "✓ Frontend dependencies installed"
else
    echo "✓ Frontend dependencies already installed"
fi
cd ..
echo ""

# Step 3: Run C++ Scheduler
echo "[3/4] Running C++ scheduler..."
echo "-----------------------------------"
./scheduler
echo "-----------------------------------"
echo "✓ Scheduler execution completed"
echo ""

# Step 4: Start Frontend Development Server
echo "[4/4] Starting React dashboard..."
echo "-----------------------------------"
echo "The dashboard will open in your browser."
echo "Press Ctrl+C to stop the server."
echo "-----------------------------------"
cd frontend
npm run dev
