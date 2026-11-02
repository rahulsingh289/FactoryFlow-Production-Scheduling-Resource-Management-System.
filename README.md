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

### Run it

Build the engine, then start the two servers in separate terminals:

```bash
# 1. Build the C++ OS engine
cd engine
g++ -std=c++17 -Iinclude src/*.cpp -o factory_engine     # factory_engine.exe on Windows

# 2. Backend API  (terminal 1)
cd ../backend
npm install
npm start            # http://localhost:4000

# 3. Frontend dashboard  (terminal 2)
cd ../frontend
npm install
npm run dev          # http://localhost:3000
```

**Login:** `manager` / `manager123`  (or `operator` / `operator123`)

### Demo mode vs. MySQL mode
The backend tries MySQL first. **If MySQL is not running it automatically starts
in demo mode**, using in-memory data (seeded identically to `02_seed.sql`) so the
website still works. The dashboard shows which mode is active.

To use **real MySQL**:
1. Start MySQL and set credentials in `backend/.env` (copy from `.env.example`).
2. On first launch the backend auto-creates and seeds the `smart_factory`
   database (it loads `01_schema.sql`, `02_seed.sql`, `03_views.sql`).
3. Load the rest of the DBMS feature set once in the MySQL CLI (procedures,
   triggers, events, roles):
   ```bash
   mysql -u root -p smart_factory < database/04_procedures.sql
   mysql -u root -p smart_factory < database/05_triggers.sql
   mysql -u root -p             < database/06_security.sql   # optional (roles/grants)
   ```
   Or load everything from scratch, in order (`01` → `06`):
   ```bash
   mysql -u root -p < database/01_schema.sql
   for f in 02_seed 03_views 04_procedures 05_triggers 06_security; do
     mysql -u root -p smart_factory < database/$f.sql
   done
   ```
   Ready-to-run demonstration queries are in
   [`database/queries.sql`](database/queries.sql).

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

See [`database/queries.sql`](database/queries.sql) for ready-to-run SQL
demonstration queries and [`docs/diagrams/`](docs/diagrams/) for the HLD, LLD and
ER diagrams.

---

## Project structure

```
.
├── engine/                 C++ OS engine (scheduling, Banker's, deadlock)
│   ├── include/            headers  (scheduling.h, bankers.h)
│   └── src/                main.cpp, scheduling.cpp, bankers.cpp
├── backend/                Node + Express REST API
│   ├── .env.example
│   └── src/
│       ├── server.js
│       ├── routes/         auth · catalog · os · reports
│       ├── services/       auth.js (JWT) · engine.js (C++ bridge)
│       └── db/             index.js · repo.js · memoryStore.js
├── database/               MySQL — numbered in load order
│   ├── 01_schema.sql   02_seed.sql    03_views.sql
│   ├── 04_procedures.sql  05_triggers.sql  06_security.sql
│   └── queries.sql         demonstration query pack
├── frontend/               React + Vite dashboard
│   └── src/
│       ├── App.jsx  main.jsx  api.js  style.css
│       ├── components/     ui.jsx · icons.jsx
│       └── pages/          Dashboard · Orders · Scheduler · Resources · Bankers · Reports
├── docs/diagrams/          HLD · LLD · ER (SVG + generator)
├── api/index.js            Vercel serverless entry point (wraps backend/src/app.js)
└── vercel.json              Vercel build/deploy config
```

---

## Deploying to Vercel

See [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md) for the full guide. Short version:
push to GitHub, import the repo on vercel.com, add your cloud MySQL
credentials and a `JWT_SECRET` as Environment Variables, click Deploy.
