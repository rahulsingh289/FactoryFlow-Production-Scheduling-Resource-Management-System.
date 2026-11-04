// Machines.
const { memData, isMysql, q, httpError, inTransaction } = require('./shared');

// ------------------------------- Machines ----------------------------------
async function listMachines() {
  if (isMysql()) {
    const [rows] = await q(
      `SELECT m.*, COUNT(a.allocation_id) AS in_use,
              GROUP_CONCAT(o.product_name SEPARATOR ', ') AS current_orders
       FROM machines m
       LEFT JOIN resource_allocations a ON a.machine_id = m.machine_id AND a.status = 'ALLOCATED'
       LEFT JOIN production_orders o ON o.order_id = a.order_id
       GROUP BY m.machine_id
       ORDER BY m.machine_id`
    );
    return rows;
  }
  const d = memData();
  return d.machines.map((m) => {
    const active = d.allocations.filter((a) => a.machine_id === m.machine_id && a.status === 'ALLOCATED');
    const names = active.map((a) => d.orders.find((o) => o.order_id === a.order_id)?.product_name);
    return { ...m, in_use: active.length, current_orders: names.join(', ') || null };
  });
}
// A machine running an order can't be taken offline; finish the order first.
async function setMachineStatusTx(conn, id, status) {
  const [[machine]] = await conn.query('SELECT machine_id FROM machines WHERE machine_id = ? FOR UPDATE', [id]);
  if (!machine) throw httpError(404, 'Machine not found.');
  const [[{ used }]] = await conn.query(
    `SELECT COUNT(*) AS used FROM resource_allocations WHERE machine_id = ? AND status = 'ALLOCATED'`, [id]
  );
  if (used > 0) throw httpError(409, 'This machine is running an order. Finish or stop the order first.');
  await conn.query('UPDATE machines SET status = ? WHERE machine_id = ?', [status, id]);
}

function memSetMachineStatus(d, id, status) {
  const m = d.machines.find((x) => x.machine_id === id);
  if (!m) throw httpError(404, 'Machine not found.');
  if (d.allocations.some((a) => a.machine_id === id && a.status === 'ALLOCATED')) {
    throw httpError(409, 'This machine is running an order. Finish or stop the order first.');
  }
  m.status = status;
}

async function updateMachineStatus(id, status) {
  if (isMysql()) return inTransaction((conn) => setMachineStatusTx(conn, id, status));
  return memSetMachineStatus(memData(), id, status);
}
async function addMachine({ machine_name, machine_type, capacity = 1, status = 'AVAILABLE' }) {
  if (isMysql()) {
    const [r] = await q('INSERT INTO machines (machine_name, machine_type, capacity, status) VALUES (?,?,?,?)',
      [machine_name, machine_type, capacity, status]);
    return { machine_id: r.insertId, machine_name, machine_type, capacity, status };
  }
  const d = memData();
  const m = { machine_id: ++d.seq.machine, machine_name, machine_type, capacity, status };
  d.machines.push(m); return m;
}
async function deleteMachine(id) {
  const inUseError = () => httpError(409, 'This machine is running an order. Finish or stop the order first.');
  if (isMysql()) {
    await inTransaction(async (conn) => {
      const [[machine]] = await conn.query('SELECT machine_id FROM machines WHERE machine_id = ? FOR UPDATE', [id]);
      if (!machine) throw httpError(404, 'Machine not found.');
      const [[{ used }]] = await conn.query(
        `SELECT COUNT(*) AS used FROM resource_allocations WHERE machine_id = ? AND status = 'ALLOCATED'`, [id]
      );
      if (used > 0) throw inUseError();
      await conn.query('DELETE FROM machines WHERE machine_id = ?', [id]);
    });
    return;
  }
  const d = memData();
  if (!d.machines.some((m) => m.machine_id === id)) throw httpError(404, 'Machine not found.');
  if (d.allocations.some((a) => a.machine_id === id && a.status === 'ALLOCATED')) throw inUseError();
  d.machines = d.machines.filter((m) => m.machine_id !== id);
}

module.exports = { listMachines, updateMachineStatus, addMachine, deleteMachine };
