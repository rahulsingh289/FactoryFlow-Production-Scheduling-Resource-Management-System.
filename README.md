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
| Orders as processes, with enforced state changes (READY, RUNNING, BLOCKED, COMPLETED) | 14 tables with foreign keys, CHECK constraints and a generated column |
| FCFS, SJF, SRTF, Priority (preemptive + non), Round Robin | 10 views behind the reports (ready queue, Banker's matrix, utilisation, …) |
| Gantt chart, waiting/turnaround/response, throughput, makespan | 5 functions and 5 procedures (`sp_add_order`, `sp_complete_order`, …) |
| Dispatcher that starts ready orders in policy order until machines or workers run out | 15 triggers (stock ledger, pool balances, guards) and a scheduled event |
| Banker's Algorithm on the real machine slots and workers: check, grant, or wait | Transactions with row locking, retried if the database reports a deadlock |
| Deadlock detection, and recovery by preempting an order | Reports built from the SQL views; `queries.sql` has the viva queries |

The scheduling, Banker's and deadlock algorithms are all in **C++**. More SQL for the
viva is in [`database/queries.sql`](database/queries.sql).

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
- **MySQL 8+**

### Run it

Build the engine, set your database password, then start the two servers in
separate terminals:

```bash
# 1. Build the C++ OS engine
cd engine
g++ -std=c++17 -Iinclude src/*.cpp -o factory_engine     # factory_engine.exe on Windows

# 2. Configure the backend: set DB_PASSWORD and JWT_SECRET in backend/.env
cd ../backend
cp .env.example .env

# 3. Backend API  (terminal 1)
npm install
npm start            # http://localhost:4000

# 4. Frontend dashboard  (terminal 2)
cd ../frontend
npm install
npm run dev          # http://localhost:3000
```

Create your account on the sign-in page. There are no built-in logins.

### Accounts and roles
There are two roles. A **manager** can change anything. A **view-only** account
(`OPERATOR`) can look at every page, start and finish orders, run the scheduler and
test a Banker's request, but can't add, edit or delete orders, machines, workers,
stock or pools, or grant and release resources.

- With nothing set, every new account is a manager (fine on your own machine).
- Set `MANAGER_CODE` in `backend/.env` (or in Vercel) and new accounts become
  view-only unless they enter that code when creating the account. The form only
  shows the code box when one is set.

### How the pieces work together
- An order **needs one machine slot of its type and one worker trained on that type**.
  Workers have a *Trained on* machine type, or "Any machine". A specialist is chosen
  before a general worker, in the scheduler and when an order is started.
- An order can list **materials**. They come out of stock once, when the order first
  starts, and the stock ledger records it. If stock is short the order doesn't start,
  and nothing else changes.
- An order can be **edited** until it is completed. A running order keeps its machine
  type, and an order whose materials were used keeps its materials.
- Pages **refresh by themselves** every few seconds while the tab is open.

### The database
The backend sets up MySQL by itself each time it starts:

- **No tables yet:** it creates the `smart_factory` database and loads the
  schema, the factory's machines and workers, views, routines and triggers.
- **An older copy:** it adds any missing columns and reloads views, routines and
  triggers. Your data stays.

It never drops anything. To start over, run `DROP DATABASE smart_factory;` and
restart the backend. The only file it doesn't load is
[`06_security.sql`](database/06_security.sql), which creates server-wide roles:

```bash
mysql -u root -p < database/06_security.sql   # optional
```

If MySQL can't be reached the backend still starts, on an empty in-memory store
that is lost when it stops.

### Seeing a deadlock
On **Safety & Deadlock**, tick **Show details**. Take two orders that use the same
machine type (three slots in this example):

1. Press **Edit maximum** on both orders and set that machine type to 3.
2. Request 2 units of that machine type for the first order. It's granted.
3. Use **Check only** to request 1 unit for the second order. It says this is unsafe.
   Pressing **Request** instead makes the order wait.
4. Press **Force** on the same request. It's granted, and the status turns Unsafe.
5. Request 1 more unit for each order. Neither can be served: **Deadlock**.
6. Press **Release to fix** on one order, then **Retry** on the other.

---

## REST API summary

Everything except `/api/auth/*` and `/api/health` needs a signed-in user's token.
Changes to orders, machines, workers, stock and pools need a manager account; a
view-only account gets a 403.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Create an account / get a JWT |
| GET  | `/api/auth/options` | Whether sign-up asks for a manager code |
| GET  | `/api/health` | Database and engine status |
| GET/POST/DELETE | `/api/orders` | List, create and delete production orders (an order can list `materials`). The list holds every unfinished order and the newest 25 finished ones; `?finished=all` returns the whole history |
| GET  | `/api/orders/counts` | How many orders are in each state |
| PATCH | `/api/orders/:id` | Edit an order's details and, before it starts, its materials |
| PATCH | `/api/orders/:id/status` | Move an order to another state, if the move is allowed |
| GET/POST/PATCH/DELETE | `/api/machines`, `/api/workers` | The factory's machines and workers |
| PATCH | `/api/workers/:id` | Change the machine type a worker is trained on |
| GET/POST/PATCH/DELETE | `/api/inventory`, `/api/inventory/ledger` | Materials and their stock ledger |
| GET/POST/DELETE | `/api/pools` | Resource pools (only ones added by hand can be deleted) |
| POST | `/api/os/schedule`, `/api/os/compare` | Run one scheduling algorithm (C++), or compare all six |
| POST | `/api/os/dispatch` | Start ready orders in policy order |
| GET  | `/api/os/bankers` | Safe-state check + matrices |
| GET  | `/api/os/safety` | The same, plus deadlock detection, from one read (what the pages use) |
| POST | `/api/os/bankers/request` | Check, grant or force a resource request |
| POST | `/api/os/bankers/release` | Take back everything an order holds |
| PATCH | `/api/os/bankers/claims` | Change an order's Maximum |
| GET  | `/api/os/deadlock` | Deadlock detection |
| GET  | `/api/reports/dashboard`, `/analytics`, `/schedule-runs` | Reports |

---

## The C++ engine on its own

The engine can also be run from the command line:

```bash
# Schedule: "ALGO QUANTUM"; N, then "pid arrival burst priority machineType";
# M, then "machineId capacity machineType"; W, then "workerId workerType" (-1 = any machine).
# Here: 3 orders, 2 machines of type 0, 1 worker who can run any machine, so only one
# order runs at a time.
printf "SJF 0\n3\n1 0 6 2 0\n2 1 8 1 0\n3 2 7 3 0\n2\n1 1 0\n2 1 0\n1\n7 -1\n" | engine/factory_engine schedule

# Banker's: "N M", available vector, then "pid alloc... max..." rows
printf "5 3\n3 3 2\n1 0 1 0 7 5 3\n2 2 0 0 3 2 2\n3 3 0 2 9 0 2\n4 2 1 1 2 2 2\n5 0 0 2 4 3 3\n" \
  | engine/factory_engine bankers
```

See [`docs/diagrams/`](docs/diagrams/) for the HLD, LLD and ER diagrams.

---

## Tests

```bash
cd backend && npm test
```

No database is needed. It runs the C++ engine against 900 random factories (checking
that no machine or worker is ever double-booked and every order runs exactly its burst),
the textbook Banker's example, deadlock detection, and the whole REST API in memory mode
(roles, editing, materials, worker skills).
Build the engine first.

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
│       ├── app.js          Express app (shared by server.js and Vercel)
│       ├── routes/         auth · catalog · os · reports
│       ├── middleware/     auth.js (JWT) · rateLimit.js
│       ├── services/       engine.js (C++ bridge)
│       └── db/             index.js (connect + migrate) · memoryStore.js
│           └── repo/       one file per area: orders · machines · workers · inventory
│                           pools · bankers · scheduling · reports · users · shared
│   └── test/               engine.test.js · api.test.js   (npm test)
├── database/               MySQL — numbered in load order
│   ├── 01_schema.sql   02_seed.sql    03_views.sql
│   ├── 04_procedures.sql  05_triggers.sql  06_security.sql
│   └── queries.sql         query pack for the viva
├── frontend/               React + Vite dashboard
│   └── src/
│       ├── App.jsx  main.jsx  api.js  useLive.js  style.css
│       ├── components/     ui.jsx · icons.jsx
│       └── pages/          Home · Login · Dashboard · Orders · Scheduler · Machines
│                           Workers · Resources · Bankers · Reports
├── docs/
│   ├── DEPLOY.md           deploying to Vercel
│   └── diagrams/           HLD · LLD · ER (SVG + generator)
├── api/index.js            Vercel serverless entry point (wraps backend/src/app.js)
└── vercel.json             Vercel build/deploy config
```

---

## Deploying to Vercel

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full guide. Short version:
push to GitHub, import the repo on vercel.com, add your cloud MySQL
credentials and a `JWT_SECRET` as Environment Variables, click Deploy.
