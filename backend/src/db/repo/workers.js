// Workers.
const { changesFactory } = require('./pools');
const { memData, isMysql, q, httpError, inTransaction } = require('./shared');

// -------------------------------- Workers ----------------------------------
async function listWorkers() {
  if (isMysql()) {
    const [rows] = await q(
      `SELECT w.*, o.product_name AS current_order
       FROM workers w
       LEFT JOIN resource_allocations a ON a.worker_id = w.worker_id AND a.status = 'ALLOCATED'
       LEFT JOIN production_orders o ON o.order_id = a.order_id
       ORDER BY w.worker_id`
    );
    return rows;
  }
  const d = memData();
  return d.workers.map((w) => {
    const a = d.allocations.find((x) => x.worker_id === w.worker_id && x.status === 'ALLOCATED');
    return { ...w, current_order: a ? d.orders.find((o) => o.order_id === a.order_id)?.product_name : null };
  });
}
// machine_type is the machine type the worker is trained on; null means any machine.
async function addWorker({ full_name, skill, machine_type = null, status = 'AVAILABLE' }) {
  if (isMysql()) {
    const [r] = await q('INSERT INTO workers (full_name, skill, machine_type, status) VALUES (?,?,?,?)', [full_name, skill, machine_type, status]);
    return { worker_id: r.insertId, full_name, skill, machine_type, status };
  }
  const d = memData();
  const w = { worker_id: ++d.seq.worker, full_name, skill, machine_type, status };
  d.workers.push(w); return w;
}

// Changes which machine type a worker is trained on. Someone on a running order
// stays on it until it ends, so they can't be retrained meanwhile.
async function updateWorkerMachineType(id, machine_type) {
  const assignedError = () => httpError(409, 'This worker is on a running order. Finish or stop the order first.');
  if (isMysql()) {
    await inTransaction(async (conn) => {
      const [[worker]] = await conn.query('SELECT status FROM workers WHERE worker_id = ? FOR UPDATE', [id]);
      if (!worker) throw httpError(404, 'Worker not found.');
      if (worker.status === 'ASSIGNED') throw assignedError();
      await conn.query('UPDATE workers SET machine_type = ? WHERE worker_id = ?', [machine_type, id]);
    });
    return;
  }
  const w = memData().workers.find((x) => x.worker_id === id);
  if (!w) throw httpError(404, 'Worker not found.');
  if (w.status === 'ASSIGNED') throw assignedError();
  w.machine_type = machine_type;
}
// A worker on a running order can't go off shift; finish the order first.
async function updateWorkerStatus(id, status) {
  const assignedError = () => httpError(409, 'This worker is on a running order. Finish or stop the order first.');
  if (isMysql()) {
    await inTransaction(async (conn) => {
      const [[worker]] = await conn.query('SELECT status FROM workers WHERE worker_id = ? FOR UPDATE', [id]);
      if (!worker) throw httpError(404, 'Worker not found.');
      if (worker.status === 'ASSIGNED') throw assignedError();
      await conn.query('UPDATE workers SET status = ? WHERE worker_id = ?', [status, id]);
    });
    return;
  }
  const w = memData().workers.find((x) => x.worker_id === id);
  if (!w) throw httpError(404, 'Worker not found.');
  if (w.status === 'ASSIGNED') throw assignedError();
  w.status = status;
}

async function deleteWorker(id) {
  const assignedError = () => httpError(409, 'This worker is on a running order. Finish or stop the order first.');
  if (isMysql()) {
    await inTransaction(async (conn) => {
      const [[worker]] = await conn.query('SELECT status FROM workers WHERE worker_id = ? FOR UPDATE', [id]);
      if (!worker) throw httpError(404, 'Worker not found.');
      if (worker.status === 'ASSIGNED') throw assignedError();
      await conn.query('DELETE FROM workers WHERE worker_id = ?', [id]);
    });
    return;
  }
  const d = memData();
  const w = d.workers.find((x) => x.worker_id === id);
  if (!w) throw httpError(404, 'Worker not found.');
  if (w.status === 'ASSIGNED') throw assignedError();
  d.workers = d.workers.filter((x) => x.worker_id !== id);
}

module.exports = { listWorkers, addWorker: changesFactory(addWorker), updateWorkerMachineType: changesFactory(updateWorkerMachineType), updateWorkerStatus: changesFactory(updateWorkerStatus), deleteWorker: changesFactory(deleteWorker) };
