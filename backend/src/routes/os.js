// Operating-System endpoints: scheduling, dispatching, Banker's Algorithm and
// deadlock detection. All the heavy lifting happens in the C++ engine.
const express = require('express');
const repo = require('../db/repo');
const engine = require('../services/engine');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// A view-only account can look at the Banker's matrices and test a request
// ("check"), but only a manager can change them.
const manager = requireRole('MANAGER');
const managerOnly = (req, res, next) => (req.body?.action && req.body.action !== 'check' ? manager(req, res, next) : next());

const ALGORITHMS = ['FCFS', 'SJF', 'SRTF', 'PRIORITY', 'PRIORITYP', 'RR'];

const parseQuantum = (raw) => Math.max(1, Math.floor(Number(raw)) || 2);
const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

function explainUnschedulable(raw, ready) {
  const orderById = new Map(ready.map((o) => [o.pid, o]));
  return raw.unschedulable.map(({ pid, reason }) => {
    const order = orderById.get(pid) || {};
    let message = 'This order has no execution time.';
    if (reason === 'NO_WORKER') message = order.machine_type ? `No worker on shift is trained for ${order.machine_type}.` : 'No workers are on shift.';
    if (reason === 'NO_MACHINE') {
      message = order.machine_type ? `No usable machine of type ${order.machine_type}.` : 'No usable machines.';
    }
    return { pid, product_name: order.product_name, message };
  });
}

const resourceSummary = (resources) => ({
  machines: resources.machines.length,
  machineSlots: resources.machines.reduce((sum, m) => sum + m.capacity, 0),
  workers: resources.workers.length,
});

// POST /api/os/schedule  { algorithm, quantum }
// Runs the chosen policy over the ready queue and stores the run. The previous
// run comes back too, so the page can show what changed.
router.post('/schedule', async (req, res, next) => {
  try {
    const algorithm = String(req.body?.algorithm || 'FCFS').toUpperCase();
    const quantum = parseQuantum(req.body?.quantum);
    if (!ALGORITHMS.includes(algorithm)) return res.status(400).json({ error: `algorithm must be one of ${ALGORITHMS.join(', ')}` });

    const ready = await repo.getReadyOrders();
    if (ready.length === 0) return res.json({ algorithm, gantt: [], processes: [], empty: true });

    const resources = await repo.getSchedulingResources();
    const result = await engine.schedule(algorithm, quantum, ready, resources);

    // decorate slices and processes with product, machine and worker names
    const nameByPid = new Map(ready.map((o) => [o.pid, { name: o.product_name, deadline: o.deadline }]));
    const machineName = new Map(resources.machines.map((m) => [m.machine_id, m.machine_name]));
    const workerName = new Map(resources.workers.map((w) => [w.worker_id, w.full_name]));
    result.gantt = result.gantt.map((g) => ({
      ...g,
      product_name: (nameByPid.get(g.pid) || {}).name,
      machine_name: machineName.get(g.machine),
      worker_name: workerName.get(g.worker),
    }));
    const processes = result.processes.map((p) => {
      const info = nameByPid.get(p.pid) || {};
      const slices = result.gantt.filter((g) => g.pid === p.pid);
      return {
        ...p,
        product_name: info.name,
        deadline: info.deadline,
        missed_deadline: info.deadline != null && p.completion > info.deadline,
        machines: [...new Set(slices.map((g) => g.machine_name))],
        workers: [...new Set(slices.map((g) => g.worker_name))],
      };
    });
    const unschedulable = explainUnschedulable(result, ready);
    const resourcesUsed = resourceSummary(resources);
    if (processes.length === 0) {
      return res.json({ ...result, processes, unschedulable, resources: resourcesUsed, runId: null, missedDeadlines: 0 });
    }

    const [previous = null] = await repo.listScheduleRuns(1);

    // persist the run (so it shows up in reports / schedule history)
    const entries = processes.map((p) => ({
      order_id: p.pid, start: p.start, completion: p.completion,
      waiting: p.waiting, turnaround: p.turnaround, response: p.response,
      missed_deadline: p.missed_deadline,
    }));
    let runId = null;
    try {
      runId = await repo.recordScheduleRun(
        { algorithm, quantum, avgWaiting: result.avgWaiting, avgTurnaround: result.avgTurnaround, avgResponse: result.avgResponse, throughput: result.throughput, makespan: result.makespan },
        entries
      );
    } catch (persistErr) {
      console.warn('[schedule] could not persist run:', persistErr.message);
    }

    res.json({ ...result, processes, unschedulable, resources: resourcesUsed, runId, previous, missedDeadlines: processes.filter((p) => p.missed_deadline).length });
  } catch (e) { next(e); }
});

// POST /api/os/dispatch  { algorithm, quantum }
// Starts READY orders in the order the chosen policy would run them, until
// machines or workers run out. Each start is its own locked transaction.
router.post('/dispatch', async (req, res, next) => {
  try {
    const algorithm = String(req.body?.algorithm || 'FCFS').toUpperCase();
    if (!ALGORITHMS.includes(algorithm)) return res.status(400).json({ error: `algorithm must be one of ${ALGORITHMS.join(', ')}` });

    const queue = await repo.getReadyOrders();
    const ready = queue.filter((o) => o.status === 'READY');
    if (ready.length === 0) return res.json({ algorithm, started: [], waiting: [] });

    const plan = await engine.schedule(algorithm, parseQuantum(req.body?.quantum), queue, await repo.getSchedulingResources());
    const startTime = new Map(plan.processes.map((p) => [p.pid, p.start]));
    const planned = ready
      .filter((o) => startTime.has(o.pid))
      .sort((a, b) => startTime.get(a.pid) - startTime.get(b.pid) || a.pid - b.pid);

    const startedIds = [];
    const waiting = explainUnschedulable(plan, ready).filter((u) => ready.some((o) => o.pid === u.pid));
    for (const o of planned) {
      try {
        await repo.updateOrderStatus(o.pid, 'RUNNING');
        startedIds.push(o.pid);
      } catch (e) {
        if (e.status !== 409) throw e;
        waiting.push({ pid: o.pid, product_name: o.product_name, message: e.message });
      }
    }

    const orders = await repo.listOrders({ statuses: ['RUNNING'] });
    const started = startedIds.map((pid) => {
      const o = orders.find((x) => x.order_id === pid);
      return { pid, product_name: o.product_name, machine: o.assigned_machine, worker: o.assigned_worker };
    });
    res.json({ algorithm, started, waiting });
  } catch (e) { next(e); }
});

// POST /api/os/compare  { quantum }
// Runs every algorithm over the ready orders and returns summary metrics so the
// policies can be compared side by side. Does NOT persist (keeps history clean).
router.post('/compare', async (req, res, next) => {
  try {
    const quantum = parseQuantum(req.body?.quantum);
    const ready = await repo.getReadyOrders();
    if (ready.length === 0) return res.json({ empty: true, rows: [] });
    const resources = await repo.getSchedulingResources();
    const deadlineByPid = new Map(ready.map((o) => [o.pid, o.deadline]));
    const runs = await Promise.all(ALGORITHMS.map((algorithm) => engine.schedule(algorithm, quantum, ready, resources)));
    // Which orders can run depends on resources, not policy, so any run will do.
    const unschedulable = explainUnschedulable(runs[0], ready);
    const orderCount = ready.length - unschedulable.length;
    const rows = orderCount === 0 ? [] : runs.map((r, i) => ({
      algorithm: ALGORITHMS[i],
      avgWaiting: r.avgWaiting, avgTurnaround: r.avgTurnaround, avgResponse: r.avgResponse,
      throughput: r.throughput, makespan: r.makespan,
      missedDeadlines: r.processes.filter((p) => deadlineByPid.get(p.pid) != null && p.completion > deadlineByPid.get(p.pid)).length,
    }));
    res.json({ rows, orderCount, unschedulable, resources: resourceSummary(resources) });
  } catch (e) { next(e); }
});

// GET /api/os/bankers  -> current safe-state check + matrix
router.get('/bankers', async (req, res, next) => {
  try {
    const data = await repo.getBankersData();
    const result = await engine.bankers(data);
    res.json({ ...data, ...result, sequenceNames: namesFor(data, result.sequence) });
  } catch (e) { next(e); }
});

// GET /api/os/safety  -> the safe-state check AND deadlock detection from one read
// of the matrices (the Safety page and Dashboard need both). The deadlock result
// is under `deadlock`.
router.get('/safety', async (req, res, next) => {
  try {
    const data = await repo.getBankersData();
    const [result, deadlock] = await Promise.all([engine.bankers(data), engine.deadlock(data)]);
    res.json({ ...data, ...result, sequenceNames: namesFor(data, result.sequence), deadlock });
  } catch (e) { next(e); }
});

// POST /api/os/bankers/request  { order_id, units:[..], action }
//   check  reports what would happen and changes nothing
//   grant  allocates if the system stays safe; otherwise the order waits
//   force  allocates without the safety check, which is how a deadlock can happen
// An order can never take more than its Maximum or more than is free.
router.post('/bankers/request', managerOnly, async (req, res, next) => {
  try {
    const action = req.body?.action ?? 'check';
    const order_id = Number(req.body?.order_id);
    const units = (Array.isArray(req.body?.units) ? req.body.units : []).map(Number);
    if (!['check', 'grant', 'force'].includes(action)) return res.status(400).json({ error: 'action must be check, grant or force' });
    if (!isPositiveInt(order_id)) return res.status(400).json({ error: 'order_id must be a positive whole number' });
    if (!units.length || !units.every((u) => Number.isInteger(u) && u >= 0) || !units.some((u) => u > 0)) {
      return res.status(400).json({ error: 'Ask for at least one unit, in whole numbers.' });
    }

    await repo.getBankersData(); // bring pools up to date before taking their locks
    const result = await repo.withPoolsLocked(async (conn) => {
      const data = await repo.getBankersData({ conn });
      if (units.length !== data.pools.length) {
        throw Object.assign(new Error('The resource pools just changed. Reload and try again.'), { status: 409 });
      }
      const order = data.orders.find((o) => o.order_id === order_id);
      if (!order) throw Object.assign(new Error('Order not found, or already finished.'), { status: 404 });

      const decision = await engine.bankers(data, { order_id, units });
      const sequenceNames = namesFor(data, decision.sequence);
      if (units.some((u, j) => u > order.need[j])) {
        return { outcome: 'REFUSED', message: `This is more than the order's Maximum allows.` };
      }

      const poolIds = data.pools.map((p) => p.pool_id);
      const notEnoughFree = units.some((u, j) => u > data.pools[j].available_units);
      const waitMessage = notEnoughFree ? 'Not enough units are free right now.' : 'Granting this now would leave the system unsafe.';

      if (action === 'check') {
        if (decision.granted) return { outcome: 'SAFE', message: 'Granting this keeps the system safe.', sequenceNames };
        return { outcome: notEnoughFree ? 'WOULD_WAIT' : 'UNSAFE', message: waitMessage };
      }
      if (notEnoughFree || (action === 'grant' && !decision.granted)) {
        await repo.recordWaitingRequest(conn, order_id, poolIds, units);
        return { outcome: 'WAITING', message: `${waitMessage} The order is now waiting for these units.` };
      }
      await repo.grantClaim(conn, order_id, poolIds, units);
      if (decision.granted) return { outcome: action === 'force' ? 'FORCED' : 'GRANTED', safe: true, message: 'The system is still safe.', sequenceNames };
      return { outcome: 'FORCED', safe: false, message: 'The safety check was skipped, and the system is now unsafe.' };
    });
    res.json(result);
  } catch (e) { next(e); }
});

// POST /api/os/bankers/release  { order_id }   -> deadlock recovery by preemption
router.post('/bankers/release', manager, async (req, res, next) => {
  try {
    const order_id = Number(req.body?.order_id);
    if (!isPositiveInt(order_id)) return res.status(400).json({ error: 'order_id must be a positive whole number' });
    await repo.preemptOrder(order_id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PATCH /api/os/bankers/claims  { order_id, pool_id, max_units }
router.patch('/bankers/claims', manager, async (req, res, next) => {
  try {
    const order_id = Number(req.body?.order_id);
    const pool_id = Number(req.body?.pool_id);
    const max_units = Number(req.body?.max_units);
    if (!isPositiveInt(order_id) || !isPositiveInt(pool_id)) return res.status(400).json({ error: 'order_id and pool_id must be positive whole numbers' });
    if (!Number.isInteger(max_units) || max_units < 0) return res.status(400).json({ error: 'Maximum must be a whole number, 0 or more.' });
    await repo.setClaimMax(order_id, pool_id, max_units);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/os/deadlock  -> detection over what orders are waiting for right now
router.get('/deadlock', async (req, res, next) => {
  try {
    const data = await repo.getBankersData();
    const result = await engine.deadlock(data);
    res.json({ ...data, ...result });
  } catch (e) { next(e); }
});

function namesFor(data, pids) {
  const byId = new Map(data.orders.map((o) => [o.order_id, o.product_name]));
  return (pids || []).map((id) => ({ order_id: id, product_name: byId.get(id) }));
}

module.exports = router;
