# Deploying to Vercel

This project is a React frontend + an Express/MySQL backend that spawns a
compiled C++ engine. Vercel doesn't run long-lived Node servers, so the
backend is adapted into **one Vercel serverless function** (`api/index.js`)
that wraps the same Express app used locally. Both the frontend and the API
deploy together as a single Vercel project — one "Deploy" click.

## How it's wired

```
vercel.json          → build + routing config Vercel reads automatically
api/index.js          → serverless function; every /api/* request lands here
backend/src/app.js     → the Express app itself (routes, middleware) — shared
                          by api/index.js (Vercel) and backend/src/server.js
                          (local `npm start`)
engine/factory_engine  → compiled during the Vercel build step, bundled into
                          the function via vercel.json's `includeFiles`
database/*.sql         → also bundled, so the function can set up the database
```

Local development (`npm start` in `backend/`, `npm run dev` in `frontend/`)
is **unchanged** — none of this affects how you already run it day to day.

## Before you deploy: you need a MySQL database Vercel can reach

Your Mac's MySQL only listens on `localhost` — Vercel's servers cannot reach
it. You need a MySQL database reachable over the internet. Check current
pricing before choosing, since free plans change:

- **[Aiven](https://aiven.io)** — managed MySQL
- **[Railway](https://railway.app)** — one-click MySQL
- **[PlanetScale](https://planetscale.com)** — MySQL-compatible, so check its
  compatibility page first: this project uses triggers, stored routines and
  foreign keys

Create a database, then note its host, port, username, password and database
name — you'll paste these into Vercel's dashboard in step 3 below.

> Without this, the deployed app falls back to the same in-memory store used
> locally when MySQL is unreachable — it will run, but nothing persists
> between requests in any useful way on a serverless platform. Set up a real
> database for the deployment to be worth anything.

## Deploy steps

### 1. Push this code to GitHub
```bash
git push origin main
```

### 2. Import the project in Vercel
Go to **vercel.com → Add New → Project**, select this GitHub repo. Vercel
reads `vercel.json` automatically — you don't need to change any build
settings in the UI.

### 3. Add Environment Variables
In the project's **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `DB_HOST` | your cloud MySQL host |
| `DB_PORT` | usually `3306` (or whatever your provider gives you) |
| `DB_USER` | your cloud MySQL username |
| `DB_PASSWORD` | your cloud MySQL password |
| `DB_NAME` | `smart_factory` |
| `MANAGER_CODE` | optional. When set, new accounts are view-only unless they sign up with this code. Without it **anyone who opens the site can create a manager account and change everything**, so set it for a public deployment. |
| `JWT_SECRET` | a long random string — **do not reuse this placeholder.** Generate your own with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |

`JWT_SECRET` is required here. Every Vercel instance would otherwise generate its
own random secret and sign people out at random, so the backend refuses to start
on Vercel without it (the logs say `JWT_SECRET is not set`).

### 4. Deploy
Click **Deploy**. Vercel runs `npm run build` (compiles the C++ engine, then
builds the React app) and publishes both.

### 5. First-run check
Open `https://<your-project>.vercel.app/api/health` — it should show
`"dbMode": "mysql"`. If it shows `"memory"`, your database env vars aren't
being picked up — re-check step 3 and redeploy.

On first successful connection, the backend creates the tables, views, routines
and triggers by itself, the same as locally, so the first request takes a little
longer. Then add an order and start it: the Inventory page's stock ledger should show an entry after you change a quantity.

Some hosted databases refuse triggers or routines for ordinary users. The app
still runs if they do, but the stock ledger stays empty, and the
function log shows `could not create routines or triggers`. On MySQL, the usual
fix is turning on `log_bin_trust_function_creators` in your provider's settings
and then redeploying.

## The one thing to watch for in your first deploy

The compiled C++ binary (`engine/factory_engine`) and the `database/*.sql` files
are bundled into the serverless function via `includeFiles` in `vercel.json`.
This hasn't been tested on a real Vercel deployment yet.

If `/api/health` shows `"engineBuilt": false`, or scheduling/Banker's
requests fail with "C++ engine binary not found", the binary didn't make it
into the function bundle. Check the function's build logs for the engine
compile step, and confirm `engine/factory_engine` exists in the deployment.
If it's still missing, the fix is adjusting the `includeFiles` glob in
`vercel.json` (try `"{engine/**,database/**}"`).

If `/api/health` shows `"dbMode": "memory"` even though the variables are right,
look in the function log for the reason. An error about a missing `.sql` file
means the same glob needs adjusting.

## Local testing with the Vercel CLI (optional)

```bash
vercel login
vercel link            # links this folder to a Vercel project
vercel env pull         # downloads env vars into .env.local for local testing
vercel dev              # runs the full Vercel setup locally, including api/index.js
```
