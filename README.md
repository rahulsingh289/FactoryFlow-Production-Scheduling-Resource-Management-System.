# Smart Factory Production Scheduler

A full-stack web application that schedules factory **production orders** and manages
**limited resources** by applying **Operating System** concepts, backed by a
**MySQL** database. Built as a college project for the *Operating Systems* and
*DBMS* courses.

> **Team amanrwt.091** — Aman Singh Rawat (lead), Rahul Singh, Karan Singh, Anmol Bhatt

Each production order is modelled as an OS-style **process** (PID, arrival time,
burst/execution time, priority, deadline). The system schedules those processes
with classic CPU-scheduling algorithms, manages shared resources safely using the
**Banker's Algorithm**, detects **deadlocks**, and stores everything in a relational
**MySQL** database exposed through a REST API and a React dashboard.

---

## How the project maps to the two courses

| Operating Systems (≈50%) | DBMS (≈50%) |
|---|---|
| Process model / PCB (`engine/`) | 12-table relational schema with FKs & CHECK constraints |
| FCFS, SJF, SRTF, Priority (preemptive + non), Round Robin | Views (ready queue, Banker's matrix, utilisation, low stock) |
| Gantt chart, waiting/turnaround/response, throughput, makespan | Stored procedures + functions (`sp_add_order`, `sp_complete_order`, …) |
| Banker's Algorithm (safe-state + resource-request) | Triggers (audit log, claim validation) |
| Deadlock detection | Transactions (atomic order creation, resource release) |
| All of the above implemented in **C++** | Demonstration query pack for the viva (`queries.sql`) |

---

## Architecture

```
┌────────────────┐   REST/JSON    ┌────────────────────┐   stdin/stdout   ┌──────────────────┐
│  React          │ ─────────────▶ │  Node + Express     │ ───────────────▶ │  C++ OS Engine    │
│  dashboard      │ ◀───────────── │  REST API           │ ◀─────────────── │  (scheduling,     │
│  (Vite, :3000)  │                │  (:4000)            │                  │   Banker's,       │
└────────────────┘                │        │            │                  │   deadlock)       │
                                   │        ▼            │                  └──────────────────┘
                                   │   ┌──────────┐      │
                                   │   │  MySQL    │     │
                                   │   │ smart_    │     │
                                   │   │ factory   │     │
                                   │   └──────────┘      │
                                   └────────────────────┘
```

- **`engine/`** — C++17 program. The OS algorithms live here. Node runs it as a
  child process, sending a small text request and reading a JSON reply.
- **`backend/`** — Node.js + Express REST API. Handles auth (JWT), MySQL access
  (via `mysql2`, transactions) and calls the C++ engine for computations.
- **`database/`** — MySQL schema, seed data, views, stored procedures, triggers
  and a query pack.
- **`frontend/`** — React (Vite) dashboard.

> **Why Node for the REST layer?** The proposal mentions a C++ REST server, but a
> pure C++ HTTP server with a MySQL C++ connector is painful to build and run on a
> student machine. We keep **all OS algorithms in C++** (where the marks are) and
> use Node/Express + `mysql2` for the easy-to-run REST + database layer. This is a
> common and defensible split.

---

## Quick start

### Prerequisites
- **Node.js 18+** and npm
- **g++** (C++17) — `g++` on Linux/macOS, MinGW-w64 on Windows
- **MySQL 8+** *(optional — see below)*

### Run everything with one command

**macOS / Linux:**
```bash
./run.sh
```

**Windows:** double-click `run.bat` (or run it from a terminal).

This builds the C++ engine, installs dependencies, starts the API on
`http://localhost:4000` and opens the dashboard at `http://localhost:3000`.

**Login:** `manager` / `manager123`  (or `operator` / `operator123`)

### Demo mode vs. MySQL mode
The backend tries MySQL first. **If MySQL is not running, it automatically starts
in demo mode** using in-memory data (seeded identically to `seed.sql`) so the whole
website still works. The dashboard shows which mode is active.

To use **real MySQL**:
1. Start MySQL and set credentials in `backend/.env` (copy from `.env.example`).
2. On first launch the backend auto-creates and seeds the `smart_factory`
   database (it loads `schema.sql`, `seed.sql`, `views.sql`).
3. To load the full DBMS feature set (procedures, triggers, events, roles —
   needed for the DBMS viva), run the remaining files once in the MySQL CLI:
   ```bash
   mysql -u root -p smart_factory < database/procedures.sql
   mysql -u root -p smart_factory < database/triggers.sql
   mysql -u root -p          < database/security.sql   # optional (roles/grants)
   ```
   Or load everything from scratch in order:
   ```bash
   mysql -u root -p < database/schema.sql
   mysql -u root -p smart_factory < database/seed.sql
   mysql -u root -p smart_factory < database/views.sql
   mysql -u root -p smart_factory < database/procedures.sql
   mysql -u root -p smart_factory < database/triggers.sql
   mysql -u root -p smart_factory < database/security.sql
   ```

### Database work is split across the team
The SQL is organised into four owned modules (schema/normalisation, procedures/
transactions, triggers/events, views/analytics). See
[docs/DBMS_WORK_DIVISION.md](docs/DBMS_WORK_DIVISION.md) and the normalisation
proof in [docs/dbms/normalization.md](docs/dbms/normalization.md). Ready-to-run
demonstration queries are in [`database/queries.sql`](database/queries.sql).

---

## Manual setup (without the run script)

```bash
# 1. Build the C++ engine
cd engine
g++ -std=c++17 -Iinclude src/*.cpp -o factory_engine     # factory_engine.exe on Windows

# 2. Start the backend API
cd ../backend
npm install
npm start            # http://localhost:4000

# 3. Start the frontend (new terminal)
cd ../frontend
npm install
npm run dev          # http://localhost:3000
```

---

## REST API summary

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Get a JWT |
| GET  | `/api/health` | DB mode + engine status |
| GET/POST | `/api/orders` | List / create production orders |
| PATCH | `/api/orders/:id/status` | Change order state |
| GET  | `/api/machines`, `/api/workers`, `/api/inventory`, `/api/pools` | Resources |
| POST | `/api/os/schedule` | Run a scheduling algorithm (C++) |
| GET  | `/api/os/bankers` | Safe-state check + matrix |
| POST | `/api/os/bankers/request` | Resource-request safety check |
| GET  | `/api/os/deadlock` | Deadlock detection |
| GET  | `/api/reports/dashboard`, `/api/reports/schedule-runs`, `/api/reports/audit` | Reports |

---

## The C++ engine on its own

The engine is usable from the command line, which is handy for a demo:

```bash
# FCFS schedule: "ALGO QUANTUM", then N, then "pid arrival burst priority"
printf "SJF 0\n3\n1 0 6 2\n2 1 8 1\n3 2 7 3\n" | engine/factory_engine schedule

# Banker's: "N M", available vector, then "pid alloc... max..." rows
printf "5 3\n3 3 2\n1 0 1 0 7 5 3\n2 2 0 0 3 2 2\n3 3 0 2 9 0 2\n4 2 1 1 2 2 2\n5 0 0 2 4 3 3\n" \
  | engine/factory_engine bankers
```

See `docs/IMPLEMENTATION_STATUS.md` for a component-by-component status and
`database/queries.sql` for ready-to-run SQL demonstration queries.
