// ---------------------------------------------------------------------------
// Bridge to the C++ OS engine. The engine is a compiled binary in /engine;
// we run it as a child process, write a small text request on stdin and parse
// the JSON it prints on stdout. This keeps the scheduling / Banker's / deadlock
// logic in C++ (the OS half of the project).
// ---------------------------------------------------------------------------
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ENGINE_DIR = path.join(__dirname, '..', '..', '..', 'engine');
const BIN = path.join(ENGINE_DIR, process.platform === 'win32' ? 'factory_engine.exe' : 'factory_engine');

function engineAvailable() {
  return fs.existsSync(BIN);
}

// Serverless platforms (Vercel) can bundle a file without preserving its
// executable bit. Reassert it before every call; this is a cheap no-op once
// permissions are already correct, and harmless if the filesystem is
// read-only (the chmod just fails silently and the spawn below surfaces any
// real permission error with a clear message).
function ensureExecutable() {
  try { fs.chmodSync(BIN, 0o755); } catch { /* read-only fs or already correct — ignore */ }
}

function callEngine(command, stdin) {
  if (!engineAvailable()) {
    throw new Error('C++ engine binary not found. Build it with: cd engine && g++ -std=c++17 -Iinclude src/*.cpp -o factory_engine');
  }
  ensureExecutable();
  const res = spawnSync(BIN, [command], { input: stdin, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (res.status !== 0) {
    throw new Error('Engine failed: ' + (res.stderr || res.error?.message || 'unknown error'));
  }
  try {
    return JSON.parse(res.stdout.trim());
  } catch (e) {
    throw new Error('Could not parse engine output: ' + res.stdout);
  }
}

// processes: [{pid, arrival, burst, priority}]
function schedule(algorithm, quantum, processes) {
  let input = `${algorithm} ${quantum || 0}\n${processes.length}\n`;
  for (const p of processes) input += `${p.pid} ${p.arrival} ${p.burst} ${p.priority}\n`;
  return callEngine('schedule', input);
}

// data = { pools:[{available_units}], orders:[{order_id, alloc[], max[]}] }
// optional request = { order_id, units:[..] }
function bankers(data, request) {
  const m = data.pools.length;
  const n = data.orders.length;
  let input = `${n} ${m}\n`;
  input += data.pools.map((p) => p.available_units).join(' ') + '\n';
  for (const o of data.orders) {
    input += `${o.order_id} ${o.alloc.join(' ')} ${o.max.join(' ')}\n`;
  }
  if (request && request.order_id != null) {
    input += `REQUEST ${request.order_id} ${request.units.join(' ')}\n`;
  }
  return callEngine('bankers', input);
}

// Deadlock detection: each order's outstanding request = its current Need.
function deadlock(data) {
  const m = data.pools.length;
  const n = data.orders.length;
  let input = `${n} ${m}\n`;
  input += data.pools.map((p) => p.available_units).join(' ') + '\n';
  for (const o of data.orders) {
    input += `${o.order_id} ${o.alloc.join(' ')} ${o.need.join(' ')}\n`;
  }
  return callEngine('deadlock', input);
}

module.exports = { schedule, bankers, deadlock, engineAvailable };
