// ---------------------------------------------------------------------------
// Bridge to the C++ OS engine. The engine is a compiled binary in /engine;
// we run it as a child process, write a small text request on stdin and parse
// the JSON it prints on stdout. This keeps the scheduling / Banker's / deadlock
// logic in C++ (the OS half of the project). Calls are asynchronous, so a slow
// run never holds up other requests, and independent runs can go side by side.
// ---------------------------------------------------------------------------
const { spawn } = require('child_process');
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

const MAX_OUTPUT = 5 * 1024 * 1024;

function callEngine(command, stdin) {
  return new Promise((resolve, reject) => {
    if (!engineAvailable()) {
      return reject(new Error('C++ engine binary not found. Build it with: cd engine && g++ -std=c++17 -Iinclude src/*.cpp -o factory_engine'));
    }
    ensureExecutable();
    const child = spawn(BIN, [command]);
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
      if (out.length > MAX_OUTPUT) child.kill();
    });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', (e) => reject(new Error('Engine failed: ' + e.message)));
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error('Engine failed: ' + (err || `exit code ${code}`)));
      try {
        resolve(JSON.parse(out.trim()));
      } catch {
        reject(new Error('Could not parse engine output: ' + out.slice(0, 200)));
      }
    });
    child.stdin.on('error', () => {});   // the engine may exit before reading everything
    child.stdin.end(stdin);
  });
}

// The engine reads whitespace-separated numbers, so machine types (free text
// like "CNC Machine") become integer ids here. Matching ignores case.
const ANY_MACHINE = -1;
const UNKNOWN_TYPE = -2; // no machine has this type, so the order can't run

// processes: [{pid, arrival, burst, priority, machine_type}]
// resources: { machines: [{machine_id, capacity, machine_type}],
//              workers:  [{worker_id, machine_type}] }   machine_type null = can run any machine
async function schedule(algorithm, quantum, processes, resources) {
  const typeKey = (t) => String(t).trim().toLowerCase();
  const typeIds = new Map();
  for (const m of resources.machines) {
    if (!typeIds.has(typeKey(m.machine_type))) typeIds.set(typeKey(m.machine_type), typeIds.size);
  }

  let input = `${algorithm} ${quantum || 0}\n${processes.length}\n`;
  for (const p of processes) {
    const type = p.machine_type ? (typeIds.get(typeKey(p.machine_type)) ?? UNKNOWN_TYPE) : ANY_MACHINE;
    input += `${p.pid} ${p.arrival} ${p.burst} ${p.priority} ${type}\n`;
  }
  input += `${resources.machines.length}\n`;
  for (const m of resources.machines) {
    input += `${m.machine_id} ${m.capacity} ${typeIds.get(typeKey(m.machine_type))}\n`;
  }
  input += `${resources.workers.length}\n`;
  for (const w of resources.workers) {
    const type = w.machine_type ? (typeIds.get(typeKey(w.machine_type)) ?? UNKNOWN_TYPE) : ANY_MACHINE;
    input += `${w.worker_id} ${type}\n`;
  }
  return callEngine('schedule', input);
}

// data = { pools:[{available_units}], orders:[{order_id, alloc[], max[]}] }
// optional request = { order_id, units:[..] }
async function bankers(data, request) {
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

// Deadlock detection over the Request matrix: what each order is actually
// waiting for right now, not everything it might ever need.
async function deadlock(data) {
  const m = data.pools.length;
  const n = data.orders.length;
  let input = `${n} ${m}\n`;
  input += data.pools.map((p) => p.available_units).join(' ') + '\n';
  for (const o of data.orders) {
    input += `${o.order_id} ${o.alloc.join(' ')} ${o.request.join(' ')}\n`;
  }
  return callEngine('deadlock', input);
}

module.exports = { schedule, bankers, deadlock, engineAvailable };
