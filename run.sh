#!/usr/bin/env bash
# ===========================================================================
#  Smart Factory Production Scheduler — one-command launcher (macOS / Linux)
#  Builds the C++ engine, installs dependencies, then starts the backend API
#  and the React dashboard together.
# ===========================================================================
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

echo "==> 1/4  Building C++ OS engine..."
( cd engine && g++ -std=c++17 -Iinclude src/*.cpp -o factory_engine )
echo "    engine built: engine/factory_engine"

echo "==> 2/4  Installing backend dependencies..."
[ -d backend/node_modules ] || ( cd backend && npm install --no-audit --no-fund )
[ -f backend/.env ] || cp backend/.env.example backend/.env

echo "==> 3/4  Installing frontend dependencies..."
[ -d frontend/node_modules ] || ( cd frontend && npm install --no-audit --no-fund )

echo "==> 4/4  Starting servers..."
# Start the backend API (port 4000)
( cd backend && npm start ) &
BACKEND_PID=$!

# Stop the backend when this script is interrupted
trap 'echo; echo "Stopping..."; kill $BACKEND_PID 2>/dev/null; exit 0' INT TERM

sleep 1
echo ""
echo "  Backend API : http://localhost:4000/api/health"
echo "  Dashboard   : http://localhost:3000   (opening now)"
echo "  Login       : manager / manager123"
echo ""

# Start the frontend dev server (port 3000) in the foreground
( cd frontend && npm run dev )

kill $BACKEND_PID 2>/dev/null || true
