@echo off
REM ==========================================================================
REM  Smart Factory Production Scheduler - one-command launcher (Windows)
REM  Builds the C++ engine, installs dependencies, starts backend + frontend.
REM  Requires: g++ (MinGW), Node.js. Double-click this file or run from cmd.
REM ==========================================================================
cd /d "%~dp0"

echo ==^> 1/4  Building C++ OS engine...
cd engine
g++ -std=c++17 -Iinclude src/*.cpp -o factory_engine.exe
if errorlevel 1 (
  echo    ERROR: g++ build failed. Install MinGW-w64 and add it to PATH.
  pause
  exit /b 1
)
cd ..
echo     engine built: engine\factory_engine.exe

echo ==^> 2/4  Installing backend dependencies...
if not exist backend\node_modules ( cd backend && call npm install --no-audit --no-fund && cd .. )
if not exist backend\.env ( copy backend\.env.example backend\.env >nul )

echo ==^> 3/4  Installing frontend dependencies...
if not exist frontend\node_modules ( cd frontend && call npm install --no-audit --no-fund && cd .. )

echo ==^> 4/4  Starting servers...
start "Smart Factory API" cmd /k "cd backend && npm start"
timeout /t 2 >nul
echo.
echo   Backend API : http://localhost:4000/api/health
echo   Dashboard   : http://localhost:3000
echo   Login       : manager / manager123
echo.
cd frontend
call npm run dev
