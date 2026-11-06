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

const os = require('os');

const ENGINE_DIR = path.join(__dirname, '..', '..', '..', 'engine');
const BIN = process.env.ENGINE_BIN
  || path.join(ENGINE_DIR, process.platform === 'win32' ? 'factory_engine.exe' : 'factory_engine');

function engineAvailable() {
  return fs.existsSync(BIN);
}

// If the binary isn't executable and its folder is read-only, it is copied to the
// temp folder and made executable there.
let runnable = null;
function runnableBinary() {
  if (runnable) return runnable;
  try {
    fs.accessSync(BIN, fs.constants.X_OK);
    runnable = BIN;
  } catch {
    const copy = path.join(os.tmpdir(), `factory_engine_${process.pid}${path.extname(BIN)}`);
    fs.copyFileSync(BIN, copy);
    fs.chmodSync(copy, 0o755);
    runnable = copy;
  }
  return runnable;
}

const MAX_OUTPUT = 5 * 1024 * 1024;

// The engine steps through time, so absurd times could run for ever. The API keeps
// new orders inside these limits; this also protects against rows that got in some
// other way, and a run that still takes too long is stopped.
const MAX_TIME = 1_000_000;
const RUN_LIMIT_MS = 10_000;
const tooBig = (message) => Object.assign(new Error(message), { status: 422 });

function callEngine(command, stdin) {
  return new Promise((resolve, reject) => {
    if (!engineAvailable()) {
      return reject(new Error('C++ engine binary not found. Build it with: cd engine && make'));
    }
    let child;
    let finished = false;
    const done = (fn, value) => { if (!finished) { finished = true; clearTimeout(timer); fn(value); } };
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
      done(reject, tooBig('The scheduler took too long. Use shorter times, or a larger time quantum for Round Robin.'));
    }, RUN_LIMIT_MS);
    try {
      child = spawn(runnableBinary(), [command]);
    } catch (e) {
      return done(reject, new Error('Engine failed: ' + e.message));
    }
    let out = '';
    let err = '';
    let tooLarge = false;
    child.stdout.on('data', (chunk) => {
      out += chunk;
      if (out.length > MAX_OUTPUT && !tooLarge) {
        tooLarge = true;
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', (e) => done(reject, new Error('Engine failed: ' + e.message)));
    child.on('close', (code) => {
      if (tooLarge) return done(reject, tooBig('That plan is too long to show (millions of chart segments). Use a larger time quantum or shorter orders.'));
      if (code !== 0) return done(reject, new Error('Engine failed: ' + (err || `exit code ${code}`)));
      try {
        done(resolve, JSON.parse(out.trim()));
      } catch {
        done(reject, new Error('Could not parse engine output: ' + out.slice(0, 200)));
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
  const huge = processes.find((p) => p.arrival > MAX_TIME || p.burst > MAX_TIME);
  if (huge) throw tooBig(`Order ${huge.pid} has a time too large to schedule (the limit is ${MAX_TIME.toLocaleString('en-US')}). Edit the order.`);
  const span = Math.max(0, ...processes.map((p) => p.arrival)) + processes.reduce((sum, p) => sum + p.burst, 0);
  if (span > 2_000_000_000) throw tooBig('These orders add up to more time than the scheduler can handle. Shorten some of them.');
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
