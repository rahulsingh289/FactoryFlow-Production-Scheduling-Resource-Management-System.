# Windows Setup Guide

## Quick Start

### Option 1: Double-click `run.bat` (Easiest!)
Just double-click the `run.bat` file in Windows Explorer. It will:
1. Compile the C++ code
2. Install dependencies
3. Run the scheduler
4. Open your browser to http://localhost:3000

### Option 2: Using PowerShell
Right-click on the project folder → Open in Terminal (or PowerShell)
```powershell
.\run.ps1
```

### Option 3: Using Command Prompt
```cmd
run.bat
```

## Common Issues and Solutions

### Issue 1: "g++ is not recognized"
**Problem:** C++ compiler not installed

**Solution:** Install MinGW or Visual Studio with C++ support
- MinGW: https://sourceforge.net/projects/mingw/
- OR Visual Studio Community (free): https://visualstudio.microsoft.com/

After installing, make sure to add to PATH.

### Issue 2: "npm is not recognized"
**Problem:** Node.js not installed

**Solution:** Download and install Node.js from https://nodejs.org/
- Choose the LTS (Long Term Support) version
- During installation, check "Add to PATH"
- Restart your terminal/command prompt after installation

### Issue 3: Browser doesn't open automatically
**Solution:** Manually open your browser and go to:
```
http://localhost:3000
```

### Issue 4: "Port 3000 already in use"
**Solution:** Close any other programs using port 3000, or the frontend will automatically use port 3001

### Issue 5: PowerShell execution policy error
**Error:** "cannot be loaded because running scripts is disabled"

**Solution:** Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Then try running `.\run.ps1` again

## Manual Step-by-Step (If scripts don't work)

### Step 1: Compile C++ Backend
Open Command Prompt in the project folder:
```cmd
g++ -std=c++17 -Ibackend/include backend/src/main.cpp backend/src/scheduler.cpp backend/src/resource_manager.cpp backend/src/bankers.cpp -o scheduler.exe
```

### Step 2: Run the Scheduler
```cmd
scheduler.exe
```

### Step 3: Install Frontend Dependencies
```cmd
cd frontend
npm install
```

### Step 4: Start Frontend
```cmd
npm run dev
```

Then open your browser to http://localhost:3000

## Stop the Server
Press `Ctrl+C` in the terminal/command prompt to stop the development server.

## Requirements
- ✅ Windows 10 or later
- ✅ Node.js 18+ (https://nodejs.org/)
- ✅ C++ compiler (MinGW or Visual Studio)
- ✅ npm (comes with Node.js)

## Testing if Requirements are Installed

Open Command Prompt and run:
```cmd
node --version
npm --version
g++ --version
```

If any command fails, install the missing software from the links above.
