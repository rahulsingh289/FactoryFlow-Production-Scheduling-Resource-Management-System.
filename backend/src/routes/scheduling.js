// Scheduling endpoints: run a policy, compare all of them, start ready orders.
// The scheduling itself happens in the C++ engine.
const express = require('express');
const repo = require('../db/repo');
const engine = require('../services/engine');

const router = express.Router();

const ALGORITHMS = ['FCFS', 'SJF', 'SRTF', 'PRIORITY', 'PRIORITYP', 'RR'];

const parseQuantum = (raw) => Math.max(1, Math.floor(Number(raw)) || 2);

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
    // Once an order of one machine type finds no free machine or worker, every later
    // order of that type will too, so it isn't tried (each try is a database round
    // trip or many). A material shortage is specific to one order, so that is.
    const noRoomFor = new Map();
    for (const o of planned) {
      const type = String(o.machine_type || '').toLowerCase();
      if (noRoomFor.has(type)) {
        waiting.push({ pid: o.pid, product_name: o.product_name, message: noRoomFor.get(type) });
        continue;
      }
      try {
        await repo.updateOrderStatus(o.pid, 'RUNNING', { returnOrder: false });
        startedIds.push(o.pid);
      } catch (e) {
        if (e.status !== 409) throw e;
        waiting.push({ pid: o.pid, product_name: o.product_name, message: e.message });
        if (!/^Not enough stock/.test(e.message)) noRoomFor.set(type, e.message);
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

module.exports = router;
