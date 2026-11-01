// Operating-System endpoints: scheduling, Banker's Algorithm, deadlock
// detection. All the heavy lifting happens in the C++ engine.
const express = require('express');
const repo = require('../db/repo');
const engine = require('../services/engine');
const { requireAuth } = require('../services/auth');

const router = express.Router();

const ALGORITHMS = ['FCFS', 'SJF', 'SRTF', 'PRIORITY', 'PRIORITYP', 'RR'];

// POST /api/os/schedule  { algorithm, quantum }
// Runs the chosen policy over all non-completed orders and stores the run.
// Requires auth: unlike /compare, this writes a row to schedule history.
router.post('/schedule', requireAuth, async (req, res, next) => {
  try {
    const algorithm = String(req.body?.algorithm || 'FCFS').toUpperCase();
    const quantum = Number(req.body?.quantum || 2);
    if (!ALGORITHMS.includes(algorithm)) return res.status(400).json({ error: `algorithm must be one of ${ALGORITHMS.join(', ')}` });

    const ready = await repo.getReadyOrders();
    if (ready.length === 0) return res.json({ algorithm, gantt: [], processes: [], empty: true });

    const result = engine.schedule(algorithm, quantum, ready);

    // decorate each process with product name + deadline info
    const nameByPid = new Map(ready.map((o) => [o.pid, { name: o.product_name, deadline: o.deadline }]));
    const processes = result.processes.map((p) => {
      const info = nameByPid.get(p.pid) || {};
      return { ...p, product_name: info.name, deadline: info.deadline, missed_deadline: info.deadline != null && p.completion > info.deadline };
    });
    result.gantt = result.gantt.map((g) => ({ ...g, product_name: (nameByPid.get(g.pid) || {}).name }));

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

    res.json({ ...result, processes, runId, missedDeadlines: processes.filter((p) => p.missed_deadline).length });
  } catch (e) { next(e); }
});

// POST /api/os/compare  { quantum }
// Runs every algorithm over the ready orders and returns summary metrics so the
// policies can be compared side by side. Does NOT persist (keeps history clean).
router.post('/compare', async (req, res, next) => {
  try {
    const quantum = Number(req.body?.quantum || 2);
    const ready = await repo.getReadyOrders();
    if (ready.length === 0) return res.json({ empty: true, rows: [] });
    const deadlineByPid = new Map(ready.map((o) => [o.pid, o.deadline]));
    const rows = ALGORITHMS.map((algorithm) => {
      const r = engine.schedule(algorithm, quantum, ready);
      const missed = r.processes.filter((p) => deadlineByPid.get(p.pid) != null && p.completion > deadlineByPid.get(p.pid)).length;
      return {
        algorithm,
        avgWaiting: r.avgWaiting, avgTurnaround: r.avgTurnaround, avgResponse: r.avgResponse,
        throughput: r.throughput, makespan: r.makespan, missedDeadlines: missed,
      };
    });
    res.json({ rows, orderCount: ready.length });
  } catch (e) { next(e); }
});

// GET /api/os/bankers  -> current safe-state check + matrix
router.get('/bankers', async (req, res, next) => {
  try {
    const data = await repo.getBankersData();
    const result = engine.bankers(data);
    res.json({ ...data, ...result, sequenceNames: namesFor(data, result.sequence) });
  } catch (e) { next(e); }
});

// POST /api/os/bankers/request  { order_id, units:[..] }
router.post('/bankers/request', requireAuth, async (req, res, next) => {
  try {
    const data = await repo.getBankersData();
    const order_id = Number(req.body?.order_id);
    const units = (Array.isArray(req.body?.units) ? req.body.units : []).map(Number);
    const unitsValid = units.length === data.pools.length && units.every((u) => Number.isFinite(u) && u >= 0);
    if (!Number.isFinite(order_id) || !unitsValid) {
      return res.status(400).json({ error: `order_id and ${data.pools.length} non-negative unit counts are required` });
    }
    if (!data.orders.some((o) => o.order_id === order_id)) {
      return res.status(404).json({ error: 'order not found' });
    }
    const result = engine.bankers(data, { order_id, units });
    res.json({ ...data, ...result, request: { order_id, units }, sequenceNames: namesFor(data, result.sequence) });
  } catch (e) { next(e); }
});

// GET /api/os/deadlock  -> deadlock detection on current claims
router.get('/deadlock', async (req, res, next) => {
  try {
    const data = await repo.getBankersData();
    const result = engine.deadlock(data);
    res.json({ ...data, ...result });
  } catch (e) { next(e); }
});

function namesFor(data, pids) {
  const byId = new Map(data.orders.map((o) => [o.order_id, o.product_name]));
  return (pids || []).map((id) => ({ order_id: id, product_name: byId.get(id) }));
}

module.exports = router;
