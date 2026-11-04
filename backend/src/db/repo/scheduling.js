// What the scheduler plans with, and the record of every run.
const { state } = require('../index');
const { now } = require('../memoryStore');
const { memData, isMysql, q } = require('./shared');
const { listOrders } = require('./orders');
const { listMachines } = require('./machines');
const { listWorkers } = require('./workers');

// What the scheduler may plan with. Machines in maintenance and workers off
// shift are out; busy ones still count, because the plan covers their orders.
async function getSchedulingResources() {
  const [machines, workers] = await Promise.all([listMachines(), listWorkers()]);
  return {
    machines: machines.filter((m) => m.status !== 'MAINTENANCE'),
    workers: workers.filter((w) => w.status !== 'OFF_SHIFT'),
  };
}

// --------------------------- Orders for scheduling -------------------------
// Blocked orders aren't in the ready queue, so the scheduler leaves them out.
async function getReadyOrders() {
  const orders = await listOrders({ statuses: ['READY', 'RUNNING'] });
  return orders.map((o) => ({
    pid: o.order_id,
    product_name: o.product_name,
    status: o.status,
    arrival: o.arrival_time,
    burst: o.execution_time,
    priority: o.priority,
    deadline: o.deadline,
    machine_type: o.required_machine_type,
  }));
}

// ---------------------------- Schedule run history -------------------------
async function recordScheduleRun(run, entries) {
  if (isMysql()) {
    const conn = await state.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [res] = await conn.query(
        `INSERT INTO schedule_runs (algorithm, quantum, avg_waiting, avg_turnaround, avg_response, throughput, makespan)
         VALUES (?,?,?,?,?,?,?)`,
        [run.algorithm, run.quantum, run.avgWaiting, run.avgTurnaround, run.avgResponse, run.throughput, run.makespan]
      );
      const runId = res.insertId;
      for (const e of entries) {
        await conn.query(
          `INSERT INTO schedule_entries (run_id, order_id, start_time, completion_time, waiting_time, turnaround_time, response_time, missed_deadline)
           VALUES (?,?,?,?,?,?,?,?)`,
          [runId, e.order_id, e.start, e.completion, e.waiting, e.turnaround, e.response, e.missed_deadline ? 1 : 0]
        );
      }
      await conn.commit();
      return runId;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
  const d = memData();
  const run_id = ++d.seq.run;
  d.scheduleRuns.push({ run_id, ...run, created_at: now(), entries });
  return run_id;
}

async function listScheduleRuns(limit = 10) {
  if (isMysql()) {
    const [rows] = await q('SELECT * FROM v_schedule_summary ORDER BY run_id DESC LIMIT ?', [limit]);
    return rows;
  }
  return memData().scheduleRuns
    .slice(-limit).reverse()
    .map((r) => ({
      run_id: r.run_id, algorithm: r.algorithm, quantum: r.quantum,
      avg_waiting: r.avgWaiting, avg_turnaround: r.avgTurnaround, avg_response: r.avgResponse,
      throughput: r.throughput, makespan: r.makespan, created_at: r.created_at,
      orders_scheduled: r.entries.length,
      missed_deadlines: r.entries.filter((e) => e.missed_deadline).length,
    }));
}

module.exports = { getSchedulingResources, getReadyOrders, recordScheduleRun, listScheduleRuns };
