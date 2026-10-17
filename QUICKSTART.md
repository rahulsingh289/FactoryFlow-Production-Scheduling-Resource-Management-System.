# Quick Start Guide

## Run Everything with One Command

### For macOS/Linux:
```bash
./run.sh
```

### For Windows:
```powershell
.\run.ps1
```

### Using Make:
```bash
make
```

## What Gets Run:

1. **C++ Backend** - Compiles and executes the production scheduler
   - Demonstrates FCFS, SJF, and Priority scheduling algorithms
   - Shows sample production orders with timing metrics

2. **React Frontend** - Starts the web dashboard at http://localhost:3000
   - Interactive scheduling algorithm selector (dropdown at top right)
   - Add new production orders with the "+ New order" button
   - View timeline visualization
   - Search and filter orders in the table

## Frontend Features That Now Work:

✅ **Scheduling Algorithm Selector** - Switch between:
   - First Come, First Served (FCFS)
   - Shortest Job First (SJF)
   - Priority Scheduling

✅ **Add New Orders** - Click "+ New order" button to create custom production orders

✅ **Search Orders** - Filter orders by product name

✅ **Visual Timeline** - See how different algorithms affect scheduling

✅ **Real-time Metrics** - Watch metrics update as you change algorithms or add orders

## Troubleshooting:

If the frontend doesn't start:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

If the C++ backend doesn't compile:
```bash
g++ -std=c++17 -Ibackend/include \
    backend/src/main.cpp \
    backend/src/scheduler.cpp \
    backend/src/resource_manager.cpp \
    backend/src/bankers.cpp \
    -o scheduler
```

## Stopping the Application:

Press **Ctrl+C** in the terminal to stop the development server.
