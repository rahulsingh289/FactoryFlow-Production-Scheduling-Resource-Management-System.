@echo off
echo ==================================
echo Production Scheduler - Starting...
echo ==================================
echo.

REM Navigate to the script directory
cd /d "%~dp0"

REM Step 1: Compile C++ Backend
echo [1/4] Compiling C++ backend...
g++ -std=c++17 -Ibackend/include backend/src/main.cpp backend/src/scheduler.cpp backend/src/resource_manager.cpp backend/src/bankers.cpp -o scheduler.exe
if %errorlevel% neq 0 (
    echo ERROR: Backend compilation failed!
    pause
    exit /b 1
)
echo Backend compiled successfully!
echo.

REM Step 2: Install Frontend Dependencies
echo [2/4] Checking frontend dependencies...
cd frontend
if not exist "node_modules" (
    echo Installing npm packages...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: npm install failed!
        cd ..
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
) else (
    echo Dependencies already installed!
)
cd ..
echo.

REM Step 3: Run C++ Scheduler
echo [3/4] Running C++ scheduler...
echo -----------------------------------
scheduler.exe
echo -----------------------------------
echo Scheduler execution completed!
echo.

REM Step 4: Start Frontend
echo [4/4] Starting React dashboard...
echo -----------------------------------
echo Opening http://localhost:3000 in your browser...
echo Press Ctrl+C to stop the server.
echo -----------------------------------
echo.

REM Open browser
start http://localhost:3000

REM Start dev server
cd frontend
call npm run dev
