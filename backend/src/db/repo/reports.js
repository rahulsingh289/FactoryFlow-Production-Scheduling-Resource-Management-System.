// Dashboard numbers and analytics (the analytics read SQL views).
const { isMysql, q } = require('./shared');
const { countOrdersByStatus } = require('./orders');
const { listMachines } = require('./machines');
const { listWorkers } = require('./workers');

// ------------------------------- Analytics ---------------------------------
// These read the SQL views directly; without MySQL there are no views to read.
async function getAnalytics() {
  if (!isMysql()) return { benchmark: [], machines: [], workers: [], history: [], pressure: [] };
  const [[benchmark], [machines], [workers], [history], [pressure]] = await Promise.all([
    q('SELECT * FROM v_algorithm_benchmark ORDER BY mean_waiting, algorithm'),
    q('SELECT * FROM v_machine_utilization ORDER BY machine_id'),
    q('SELECT * FROM v_worker_workload ORDER BY orders_handled DESC, worker_id'),
    q('SELECT * FROM v_production_history ORDER BY run_id DESC, start_time, order_id LIMIT 30'),
    q('SELECT * FROM v_resource_pressure ORDER BY pool_id'),
  ]);
  return { benchmark, machines, workers, history, pressure };
}

// ------------------------------- Dashboard ---------------------------------
// The numbers come from counting in SQL; the machine and worker lists are
// included so the dashboard needs one call for them, not three.
async function dashboardStats() {
  const [ordersByStatus, machines, workers] = await Promise.all([countOrdersByStatus(), listMachines(), listWorkers()]);
  return {
    totalOrders: Object.values(ordersByStatus).reduce((sum, n) => sum + n, 0),
    ordersByStatus,
    totalMachines: machines.length,
    machinesAvailable: machines.filter((m) => m.status === 'AVAILABLE').length,
    machinesMaintenance: machines.filter((m) => m.status === 'MAINTENANCE').length,
    totalWorkers: workers.length,
    workersAvailable: workers.filter((w) => w.status === 'AVAILABLE').length,
    workersOffShift: workers.filter((w) => w.status === 'OFF_SHIFT').length,
    machines,
    workers,
  };
}

module.exports = { getAnalytics, dashboardStats };
