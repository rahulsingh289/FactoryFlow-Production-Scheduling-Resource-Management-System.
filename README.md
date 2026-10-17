# Smart Factory Production Scheduler — 50% Milestone

A starter implementation based on the uploaded project proposal. This milestone includes a working C++ scheduling engine, a React dashboard prototype, a MySQL schema, sample data, and integration notes.

## What is implemented
- C++ production-order model (process ID, priority, burst/execution time, deadline, state, resource requirements)
- FCFS, non-preemptive SJF, and non-preemptive Priority scheduling
- Simple resource-capacity checks and schedule metrics (waiting time, completion time, machine utilisation estimate)
- React dashboard prototype with sample orders and scheduling-algorithm selector
- MySQL schema for orders, machines, workers, inventory, allocations, and schedule history

## What is not yet implemented
This is intentionally a **50% milestone**, not a production-ready factory system. The React screen currently uses sample data; the C++ engine is a standalone executable, not yet connected to a REST API or MySQL. Authentication, concurrent resource locking, full Banker's Algorithm, deadlock detection, live persistence, and integration tests remain for the next phase. Do not describe these as completed in a viva/demo.

## Requirements
- C++17 compiler (g++ or MSVC)
- Node.js 18+ and npm (for the frontend)
- MySQL 8+ (optional for this milestone)

## Quick Start - Run Everything in One Command

### Option 1: Using the run script (Recommended)

**macOS/Linux:**
```bash
./run.sh
```

**Windows - Method 1 (Easiest):**
- Just double-click `run.bat` in Windows Explorer

**Windows - Method 2 (PowerShell):**
```powershell
.\run.ps1
```

**Windows - Method 3 (Command Prompt):**
```cmd
run.bat
```

### Option 2: Using Make (macOS/Linux only)
```bash
make all
```

The script will:
1. ✅ Compile the C++ backend (with all resource management modules)
2. ✅ Install frontend dependencies (npm packages)
3. ✅ Run the scheduler to show sample output
4. ✅ Start the React dashboard at http://localhost:3000
5. ✅ Auto-open your browser (if it doesn't open, manually go to http://localhost:3000)

### Windows Users: See [WINDOWS_SETUP.md](./WINDOWS_SETUP.md) for troubleshooting!

### Frontend Features Now Working:
- **Scheduling Algorithm Selector** - Dropdown in the "Schedule planner" section to switch between FCFS, SJF, and Priority scheduling
- **Add New Orders** - "+ New order" button to create custom production orders
- **Search Functionality** - Search bar to filter orders by product name
- **Interactive Timeline** - Visual representation updates when you change algorithms
- **Real-time Metrics** - All metrics recalculate automatically

See [QUICKSTART.md](./QUICKSTART.md) for detailed instructions and troubleshooting.

## Manual Setup (Alternative)

### Run the C++ engine
From the project root:
```bash
g++ -std=c++17 -Ibackend/include backend/src/main.cpp backend/src/scheduler.cpp backend/src/resource_manager.cpp backend/src/bankers.cpp -o scheduler
./scheduler
```
On Windows PowerShell:
```powershell
g++ -std=c++17 -Ibackend/include backend/src/main.cpp backend/src/scheduler.cpp backend/src/resource_manager.cpp backend/src/bankers.cpp -o scheduler.exe
.\scheduler.exe
```

### Run the React dashboard
```bash
cd frontend
npm install
npm run dev
```
Open the local URL printed by Vite.

## Set up MySQL (optional)
Run `database/schema.sql`, then `database/seed.sql` in MySQL Workbench or the MySQL CLI:
```sql
SOURCE path/to/database/schema.sql;
SOURCE path/to/database/seed.sql;
```

## Suggested next 50%
1. Expose the C++ scheduler through a REST API (e.g. Crow or cpp-httplib).
2. Connect API endpoints to MySQL using a supported MySQL C++ connector.
3. Implement Banker's safety algorithm and deadlock detection against allocated/available/maximum resource matrices.
4. Replace frontend sample data with API calls.
5. Add input validation, authentication, tests, and error handling.
