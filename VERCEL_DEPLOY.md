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
```

Local development (`npm start` in `backend/`, `npm run dev` in `frontend/`)
is **unchanged** — none of this affects how you already run it day to day.

## Before you deploy: you need a MySQL database Vercel can reach

Your Mac's MySQL only listens on `localhost` — Vercel's servers cannot reach
it. You need a MySQL database reachable over the internet. Any of these work
(all have a free tier):

- **[PlanetScale](https://planetscale.com)** — MySQL-compatible, popular with Vercel
- **[Railway](https://railway.app)** — one-click MySQL
- **[Aiven](https://aiven.io)** — managed MySQL free tier

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
| `JWT_SECRET` | a long random string — **do not reuse this placeholder.** Generate your own with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |

`JWT_SECRET` matters more here than locally: without it, the backend
generates a random one per cold start, which would silently sign everyone
out every time Vercel spins up a fresh instance (every few minutes of
inactivity). Set a real value.

### 4. Deploy
Click **Deploy**. Vercel runs `npm run build` (compiles the C++ engine, then
builds the React app) and publishes both.

### 5. First-run check
Open `https://<your-project>.vercel.app/api/health` — it should show
`"dbMode": "mysql"`. If it shows `"memory"`, your database env vars aren't
being picked up — re-check step 3 and redeploy.

On first successful connection, the backend auto-creates the `smart_factory`
schema (same as local dev) — no manual SQL needed for the app to work. For
the full DBMS feature set (stored procedures, triggers, roles), run those
files once against your cloud database with the `mysql` CLI, same as the
local instructions in the main README.

## The one thing to watch for in your first deploy

The compiled C++ binary (`engine/factory_engine`) is bundled into the
serverless function via `includeFiles` in `vercel.json`. This is the
standard, documented way to ship a non-JS binary alongside a Vercel
function — but it's the one part of this setup I couldn't fully verify
without an actual Vercel deployment (I tested everything else — the build
command, and the serverless handler itself — locally).

If `/api/health` shows `"engineBuilt": false`, or scheduling/Banker's
requests fail with "C++ engine binary not found", the binary didn't make it
into the function bundle. Check the function's build logs for the engine
compile step, and confirm `engine/factory_engine` exists in the deployment.
If it's still missing, the fix is adjusting the `includeFiles` glob in
`vercel.json` (try `"engine/**"` instead of the exact filename).

## Local testing with the Vercel CLI (optional)

```bash
vercel login
vercel link            # links this folder to a Vercel project
vercel env pull         # downloads env vars into .env.local for local testing
vercel dev              # runs the full Vercel setup locally, including api/index.js
```
