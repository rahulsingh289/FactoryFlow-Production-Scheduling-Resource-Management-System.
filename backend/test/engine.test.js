// Tests for the C++ engine (scheduling, Banker's Algorithm, deadlock detection).
// They only need the compiled binary, not a database.
//   cd engine && make
//   cd backend && npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../src/services/engine');

const ALGORITHMS = ['FCFS', 'SJF', 'SRTF', 'PRIORITY', 'PRIORITYP', 'RR'];

test('the engine binary is built', () => {
  assert.ok(engine.engineAvailable(), 'build it first: cd engine && make');
});

// ----------------------------- scheduling ----------------------------------
// Small seeded random generator, so a failure can be reproduced.
function rng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

function randomCase(rand) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const types = ['Saw', 'Lathe', 'Press'].slice(0, int(1, 3));
  const machines = Array.from({ length: int(1, 4) }, (_, i) => ({
    machine_id: i + 1, machine_name: `M${i + 1}`, machine_type: types[int(0, types.length - 1)], capacity: int(1, 3),
  }));
  const workers = Array.from({ length: int(1, 4) }, (_, i) => ({
    worker_id: 100 + i, machine_type: rand() < 0.4 ? null : types[int(0, types.length - 1)],
  }));
  const processes = Array.from({ length: int(1, 9) }, (_, i) => ({
    pid: i + 1, arrival: int(0, 8), burst: int(1, 7), priority: int(1, 5),
    machine_type: rand() < 0.3 ? null : types[int(0, types.length - 1)],
  }));
  return { machines, workers, processes, quantum: int(1, 4) };
}

// Checks everything that must hold for a valid schedule, whatever the policy.
function checkSchedule(name, { machines, workers, processes }, result) {
  const workerById = new Map(workers.map((w) => [w.worker_id, w]));
  const byPid = new Map(processes.map((p) => [p.pid, p]));
  const machineById = new Map(machines.map((m) => [m.machine_id, m]));
  const scheduled = new Set(result.processes.map((p) => p.pid));
  const left = new Set(result.unschedulable.map((u) => u.pid));
  assert.equal(scheduled.size + left.size, processes.length, `${name}: every order is either scheduled or reported`);

  for (const p of result.processes) {
    const slices = result.gantt.filter((g) => g.pid === p.pid).sort((a, b) => a.start - b.start);
    const total = slices.reduce((sum, g) => sum + (g.end - g.start), 0);
    const src = byPid.get(p.pid);
    assert.equal(total, src.burst, `${name}: order ${p.pid} runs exactly its burst`);
    assert.ok(slices[0].start >= src.arrival, `${name}: order ${p.pid} never starts before it arrives`);
    assert.equal(p.start, slices[0].start, `${name}: start is the first slice`);
    assert.equal(p.completion, slices[slices.length - 1].end, `${name}: completion is the last slice`);
    assert.equal(p.turnaround, p.completion - src.arrival);
    assert.equal(p.waiting, p.turnaround - src.burst);
    assert.equal(p.response, p.start - src.arrival);
    assert.ok(p.waiting >= 0, `${name}: waiting can't be negative`);
    for (let i = 1; i < slices.length; i++) assert.ok(slices[i].start >= slices[i - 1].end, `${name}: order ${p.pid} is never in two places at once`);
  }

  // At every moment: no machine over capacity, no worker on two orders, right machine type.
  const horizon = Math.max(0, ...result.gantt.map((g) => g.end));
  for (let t = 0; t < horizon; t++) {
    const live = result.gantt.filter((g) => g.start <= t && t < g.end);
    const perMachine = new Map(), perWorker = new Map();
    for (const g of live) {
      perMachine.set(g.machine, (perMachine.get(g.machine) || 0) + 1);
      perWorker.set(g.worker, (perWorker.get(g.worker) || 0) + 1);
      const skill = workerById.get(g.worker).machine_type;
      if (skill) assert.equal(machineById.get(g.machine).machine_type.toLowerCase(), skill.toLowerCase(), `${name}: worker ${g.worker} is not trained for machine ${g.machine}`);
      const need = byPid.get(g.pid).machine_type;
      if (need) assert.equal(machineById.get(g.machine).machine_type.toLowerCase(), need.toLowerCase(), `${name}: order ${g.pid} is on the wrong type of machine`);
    }
    for (const [id, used] of perMachine) assert.ok(used <= machineById.get(id).capacity, `${name}: machine ${id} over capacity at t=${t}`);
    for (const [id, used] of perWorker) assert.ok(used <= 1, `${name}: worker ${id} on ${used} orders at t=${t}`);
  }
  if (result.processes.length) {
    assert.equal(result.makespan, Math.max(...result.processes.map((p) => p.completion)));
  }
}

test('every policy produces a valid schedule on random factories', async () => {
  const rand = rng(12345);
  for (let n = 0; n < 150; n++) {
    const c = randomCase(rand);
    for (const algorithm of ALGORITHMS) {
      const result = await engine.schedule(algorithm, c.quantum, c.processes, c);
      checkSchedule(`${algorithm} case ${n}`, c, result);
    }
  }
});

test('every algorithm reports its own name, and an unknown name runs as FCFS', async () => {
  const procs = [{ pid: 1, arrival: 0, burst: 3, priority: 2, machine_type: null }];
  const res = { machines: [{ machine_id: 1, machine_type: 'Saw', capacity: 1 }], workers: [{ worker_id: 1 }] };
  for (const name of ALGORITHMS) {
    assert.equal((await engine.schedule(name, 2, procs, res)).algorithm, name);
  }
  assert.equal((await engine.schedule('NOT-AN-ALGORITHM', 2, procs, res)).algorithm, 'FCFS');
});

test('FCFS on one machine and one worker runs orders in arrival order', async () => {
  const processes = [
    { pid: 1, arrival: 0, burst: 5, priority: 3, machine_type: null },
    { pid: 2, arrival: 1, burst: 3, priority: 3, machine_type: null },
    { pid: 3, arrival: 2, burst: 1, priority: 3, machine_type: null },
  ];
  const r = await engine.schedule('FCFS', 0, processes, {
    machines: [{ machine_id: 1, machine_type: 'Saw', capacity: 1 }], workers: [{ worker_id: 1 }],
  });
  const done = Object.fromEntries(r.processes.map((p) => [p.pid, p.completion]));
  assert.deepEqual(done, { 1: 5, 2: 8, 3: 9 });
  assert.ok(Math.abs(r.avgWaiting - (0 + 4 + 6) / 3) < 0.001);
  assert.equal(r.makespan, 9);
});

test('SJF picks the shortest waiting order; SRTF preempts for a shorter one', async () => {
  const resources = { machines: [{ machine_id: 1, machine_type: 'Saw', capacity: 1 }], workers: [{ worker_id: 1 }] };
  const procs = [
    { pid: 1, arrival: 0, burst: 7, priority: 3, machine_type: null },
    { pid: 2, arrival: 2, burst: 4, priority: 3, machine_type: null },
    { pid: 3, arrival: 4, burst: 1, priority: 3, machine_type: null },
  ];
  const sjf = await engine.schedule('SJF', 0, procs, resources);
  assert.deepEqual(sjf.processes.map((p) => [p.pid, p.completion]), [[1, 7], [2, 12], [3, 8]]);
  const srtf = await engine.schedule('SRTF', 0, procs, resources);
  assert.deepEqual(Object.fromEntries(srtf.processes.map((p) => [p.pid, p.completion])), { 1: 12, 2: 7, 3: 5 });
});

test('an order that can never run is reported, not scheduled', async () => {
  const procs = [
    { pid: 1, arrival: 0, burst: 2, priority: 3, machine_type: 'Press' },
    { pid: 2, arrival: 0, burst: 2, priority: 3, machine_type: 'Saw' },
  ];
  const r = await engine.schedule('FCFS', 0, procs, {
    machines: [{ machine_id: 1, machine_type: 'Saw', capacity: 1 }], workers: [{ worker_id: 1 }],
  });
  assert.deepEqual(r.unschedulable.map((u) => [u.pid, u.reason]), [[1, 'NO_MACHINE']]);
  assert.deepEqual(r.processes.map((p) => p.pid), [2]);

  const none = await engine.schedule('FCFS', 0, procs, { machines: [{ machine_id: 1, machine_type: 'Saw', capacity: 1 }], workers: [] });
  assert.ok(none.unschedulable.every((u) => ['NO_WORKER', 'NO_MACHINE'].includes(u.reason)));
  assert.equal(none.processes.length, 0);
});

test('workers are only put on machines they are trained for', async () => {
  const procs = [
    { pid: 1, arrival: 0, burst: 3, priority: 3, machine_type: 'Saw' },
    { pid: 2, arrival: 0, burst: 3, priority: 3, machine_type: 'Lathe' },
  ];
  const machines = [
    { machine_id: 1, machine_type: 'Saw', capacity: 1 },
    { machine_id: 2, machine_type: 'Lathe', capacity: 1 },
  ];
  // Each worker only fits one machine type, so both orders run side by side.
  const both = await engine.schedule('FCFS', 0, procs, {
    machines, workers: [{ worker_id: 10, machine_type: 'Lathe' }, { worker_id: 11, machine_type: 'Saw' }],
  });
  assert.equal(both.makespan, 3);
  assert.equal(both.gantt.find((g) => g.pid === 1).worker, 11);
  assert.equal(both.gantt.find((g) => g.pid === 2).worker, 10);

  // Nobody is trained for the Lathe: that order can't run, the other one can.
  const none = await engine.schedule('FCFS', 0, procs, { machines, workers: [{ worker_id: 11, machine_type: 'Saw' }] });
  assert.deepEqual(none.unschedulable.map((u) => [u.pid, u.reason]), [[2, 'NO_WORKER']]);
  assert.deepEqual(none.processes.map((p) => p.pid), [1]);

  // A worker who can run anything covers both, one after the other.
  const general = await engine.schedule('FCFS', 0, procs, { machines, workers: [{ worker_id: 12 }] });
  assert.equal(general.makespan, 6);
});

test('a specialist is used before a worker who can run anything', async () => {
  const r = await engine.schedule('FCFS', 0,
    [{ pid: 1, arrival: 0, burst: 2, priority: 3, machine_type: 'Saw' }],
    { machines: [{ machine_id: 1, machine_type: 'Saw', capacity: 1 }], workers: [{ worker_id: 5 }, { worker_id: 6, machine_type: 'Saw' }] });
  assert.equal(r.gantt[0].worker, 6);
});

test('times too large for the scheduler are refused instead of running for ever', async () => {
  const res = { machines: [{ machine_id: 1, machine_type: 'Saw', capacity: 1 }], workers: [{ worker_id: 1 }] };
  const started = Date.now();
  await assert.rejects(
    engine.schedule('RR', 1, [{ pid: 1, arrival: 0, burst: 500_000_000, priority: 3, machine_type: null }], res),
    (err) => err.status === 422 && /too large/.test(err.message)
  );
  assert.ok(Date.now() - started < 2000, 'refused straight away');
  await assert.rejects(
    engine.schedule('FCFS', 1, [{ pid: 1, arrival: 1_000_000, burst: 1_000_000, priority: 3 }, ...Array.from({ length: 3000 }, (_, i) => ({ pid: i + 2, arrival: 0, burst: 1_000_000, priority: 3 }))], res),
    (err) => err.status === 422
  );
});

// ------------------------------ Banker's -----------------------------------
// The five-process, three-resource example from the usual OS textbook.
const textbook = () => ({
  pools: [{ available_units: 3 }, { available_units: 3 }, { available_units: 2 }],
  orders: [
    { order_id: 0, alloc: [0, 1, 0], max: [7, 5, 3] },
    { order_id: 1, alloc: [2, 0, 0], max: [3, 2, 2] },
    { order_id: 2, alloc: [3, 0, 2], max: [9, 0, 2] },
    { order_id: 3, alloc: [2, 1, 1], max: [2, 2, 2] },
    { order_id: 4, alloc: [0, 0, 2], max: [4, 3, 3] },
  ],
});

test("Banker's: the textbook state is safe with the textbook sequence", async () => {
  const r = await engine.bankers(textbook());
  assert.equal(r.safe, true);
  assert.deepEqual(r.sequence, [1, 3, 4, 0, 2]);
});

test("Banker's: requests are granted, made to wait or refused correctly", async () => {
  const ok = await engine.bankers(textbook(), { order_id: 1, units: [1, 0, 2] });
  assert.equal(ok.granted, true);

  const unsafe = await engine.bankers(textbook(), { order_id: 4, units: [3, 3, 0] });
  assert.equal(unsafe.granted, false, 'granting this would leave no safe order');

  const tooMuch = await engine.bankers(textbook(), { order_id: 1, units: [9, 0, 0] });
  assert.equal(tooMuch.granted, false, 'more than the order still needs');

  const notFree = await engine.bankers(textbook(), { order_id: 0, units: [4, 0, 0] });
  assert.equal(notFree.granted, false, 'more than is free');
});

test("Banker's: an unsafe state is reported as unsafe", async () => {
  const state = {
    pools: [{ available_units: 0 }],
    orders: [{ order_id: 1, alloc: [1], max: [2] }, { order_id: 2, alloc: [1], max: [2] }],
  };
  const r = await engine.bankers(state);
  assert.equal(r.safe, false);
  assert.deepEqual(r.sequence, []);
});

// ------------------------------- deadlock ----------------------------------
test('deadlock: two orders each holding what the other wants', async () => {
  const r = await engine.deadlock({
    pools: [{ available_units: 0 }, { available_units: 0 }],
    orders: [{ order_id: 1, alloc: [1, 0], request: [0, 1] }, { order_id: 2, alloc: [0, 1], request: [1, 0] }],
  });
  assert.equal(r.deadlocked, true);
  assert.deepEqual(r.blocked.sort(), [1, 2]);
});

test('no deadlock when a waiting order can be satisfied once another finishes', async () => {
  const r = await engine.deadlock({
    pools: [{ available_units: 0 }],
    orders: [{ order_id: 1, alloc: [1], request: [0] }, { order_id: 2, alloc: [0], request: [1] }],
  });
  assert.equal(r.deadlocked, false);
  assert.deepEqual(r.blocked, []);
});
