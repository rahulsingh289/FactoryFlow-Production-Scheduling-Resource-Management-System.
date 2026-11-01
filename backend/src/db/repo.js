// ---------------------------------------------------------------------------
// Repository: every data operation the API needs, implemented for BOTH the
// MySQL backend and the in-memory fallback store. Routes call these functions
// and never care which mode is active.
// ---------------------------------------------------------------------------
const bcrypt = require('bcryptjs');
const { state } = require('./index');
const { freshData, now } = require('./memoryStore');

let mem = null; // in-memory data, created lazily
function memData() {
  if (!mem) mem = freshData();
  return mem;
}
const isMysql = () => state.mode === 'mysql';
const q = (sql, params) => state.pool.query(sql, params);

// ----------------------------- Auth / users -------------------------------
async function findUserByUsername(username) {
  if (isMysql()) {
    const [rows] = await q('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0] || null;
  }
  return memData().users.find((u) => u.username === username) || null;
}

async function findUserByEmail(email) {
  if (isMysql()) {
    const [rows] = await q('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  }
  return memData().users.find((u) => u.email === email) || null;
}

// Create a new account. Returns the created user row (without the hash).
async function createUser({ username, email, full_name, password, role = 'MANAGER' }) {
  const hash = bcrypt.hashSync(password, 10);
  if (isMysql()) {
    const [res] = await q(
      `INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?,?,?,?,?)`,
      [username, email, hash, full_name, role]
    );
    return { user_id: res.insertId, username, email, full_name, role };
  }
  const d = memData();
  const user = { user_id: ++d.seq.user, username, email, password_hash: hash, full_name, role };
  d.users.push(user);
  return { user_id: user.user_id, username, email, full_name, role };
}

// -------------------------------- Orders -----------------------------------
async function listOrders() {
  if (isMysql()) {
    const [rows] = await q('SELECT * FROM production_orders ORDER BY order_id');
    return rows;
  }
  return [...memData().orders];
}

async function getOrder(id) {
  if (isMysql()) {
    const [rows] = await q('SELECT * FROM production_orders WHERE order_id = ?', [id]);
    return rows[0] || null;
  }
  return memData().orders.find((o) => o.order_id === id) || null;
}

async function addOrder(data) {
  const { product_name, quantity, arrival_time, execution_time, priority, deadline, required_machine_type } = data;
  if (isMysql()) {
    const conn = await state.pool.getConnection();
    try {
      await conn.beginTransaction();
      const [res] = await conn.query(
        `INSERT INTO production_orders
         (product_name, quantity, arrival_time, execution_time, priority, deadline, required_machine_type)
         VALUES (?,?,?,?,?,?,?)`,
        [product_name, quantity, arrival_time, execution_time, priority, deadline, required_machine_type]
      );
      const orderId = res.insertId;
      // default claim row per pool so the order joins the Banker's matrix
      await conn.query(
        `INSERT INTO order_resource_claims (order_id, pool_id, allocated_units, max_units)
         SELECT ?, pool_id, 0, 1 FROM resource_pools`,
        [orderId]
      );
      await conn.commit();
      return getOrder(orderId);
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
  const d = memData();
  const order_id = ++d.seq.order;
  const order = { order_id, product_name, quantity, arrival_time, execution_time, priority, deadline, required_machine_type, status: 'READY', created_at: now() };
  d.orders.push(order);
  for (const p of d.pools) d.claims.push({ order_id, pool_id: p.pool_id, allocated_units: 0, max_units: 1 });
  d.auditLog.push({ log_id: ++d.seq.log, entity: 'production_orders', entity_id: order_id, action: 'INSERT', details: `Created order "${product_name}" (qty ${quantity})`, created_at: now() });
  return order;
}

async function updateOrderStatus(id, status) {
  if (isMysql()) {
    await q('UPDATE production_orders SET status = ? WHERE order_id = ?', [status, id]);
    return getOrder(id);
  }
  const d = memData();
  const o = d.orders.find((x) => x.order_id === id);
  if (o && o.status !== status) {
    d.auditLog.push({ log_id: ++d.seq.log, entity: 'production_orders', entity_id: id, action: 'STATUS_CHANGE', details: `Order ${id}: ${o.status} -> ${status}`, created_at: now() });
    o.status = status;
  }
  return o;
}

async function deleteOrder(id) {
  if (isMysql()) {
    await q('DELETE FROM production_orders WHERE order_id = ?', [id]);
    return;
  }
  const d = memData();
  d.orders = d.orders.filter((o) => o.order_id !== id);
  d.claims = d.claims.filter((c) => c.order_id !== id);
}

// ------------------------------- Machines ----------------------------------
async function listMachines() {
  if (isMysql()) { const [rows] = await q('SELECT * FROM machines ORDER BY machine_id'); return rows; }
  return [...memData().machines];
}
async function updateMachineStatus(id, status) {
  if (isMysql()) { await q('UPDATE machines SET status = ? WHERE machine_id = ?', [status, id]); return; }
  const m = memData().machines.find((x) => x.machine_id === id);
  if (m) m.status = status;
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

// -------------------------------- Workers ----------------------------------
async function listWorkers() {
  if (isMysql()) { const [rows] = await q('SELECT * FROM workers ORDER BY worker_id'); return rows; }
  return [...memData().workers];
}
async function addWorker({ full_name, skill, status = 'AVAILABLE' }) {
  if (isMysql()) {
    const [r] = await q('INSERT INTO workers (full_name, skill, status) VALUES (?,?,?)', [full_name, skill, status]);
    return { worker_id: r.insertId, full_name, skill, status };
  }
  const d = memData();
  const w = { worker_id: ++d.seq.worker, full_name, skill, status };
  d.workers.push(w); return w;
}

// ------------------------------- Inventory ---------------------------------
async function listInventory() {
  if (isMysql()) { const [rows] = await q('SELECT * FROM inventory ORDER BY material_id'); return rows; }
  return [...memData().inventory];
}
async function updateInventoryQty(id, quantity) {
  if (isMysql()) { await q('UPDATE inventory SET quantity_available = ? WHERE material_id = ?', [quantity, id]); return; }
  const it = memData().inventory.find((x) => x.material_id === id);
  if (it) it.quantity_available = quantity;
}
async function addInventoryItem({ material_name, quantity_available = 0, reorder_level = 0, unit = 'units' }) {
  if (isMysql()) {
    const [r] = await q('INSERT INTO inventory (material_name, quantity_available, reorder_level, unit) VALUES (?,?,?,?)',
      [material_name, quantity_available, reorder_level, unit]);
    return { material_id: r.insertId, material_name, quantity_available, reorder_level, unit };
  }
  const d = memData();
  const it = { material_id: ++d.seq.material, material_name, quantity_available, reorder_level, unit };
  d.inventory.push(it); return it;
}

// -------------------------------- Pools ------------------------------------
async function listPools() {
  if (isMysql()) { const [rows] = await q('SELECT * FROM resource_pools ORDER BY pool_id'); return rows; }
  return [...memData().pools];
}
async function addPool({ pool_name, total_units, available_units }) {
  const avail = available_units == null ? total_units : available_units;
  if (isMysql()) {
    const [r] = await q('INSERT INTO resource_pools (pool_name, total_units, available_units) VALUES (?,?,?)',
      [pool_name, total_units, avail]);
    return { pool_id: r.insertId, pool_name, total_units, available_units: avail };
  }
  const d = memData();
  const p = { pool_id: ++d.seq.pool, pool_name, total_units, available_units: avail };
  d.pools.push(p); return p;
}

// --------------------- Banker's / deadlock matrices ------------------------
// Returns { pools:[{pool_id,pool_name,available_units}],
//           orders:[{order_id,product_name,alloc:[..],max:[..],need:[..]}] }
async function getBankersData() {
  const pools = (await listPools()).sort((a, b) => a.pool_id - b.pool_id);
  const poolIds = pools.map((p) => p.pool_id);

  let orders, claimLookup;
  if (isMysql()) {
    const [os] = await q(
      `SELECT DISTINCT o.order_id, o.product_name
       FROM production_orders o JOIN order_resource_claims c ON c.order_id = o.order_id
       ORDER BY o.order_id`
    );
    orders = os;
    const [claims] = await q('SELECT order_id, pool_id, allocated_units, max_units FROM order_resource_claims');
    claimLookup = claims;
  } else {
    const d = memData();
    const withClaims = new Set(d.claims.map((c) => c.order_id));
    orders = d.orders.filter((o) => withClaims.has(o.order_id)).map((o) => ({ order_id: o.order_id, product_name: o.product_name }));
    claimLookup = d.claims;
  }

  const byOrder = new Map();
  for (const c of claimLookup) {
    if (!byOrder.has(c.order_id)) byOrder.set(c.order_id, {});
    byOrder.get(c.order_id)[c.pool_id] = c;
  }

  const outOrders = orders.map((o) => {
    const alloc = [], max = [], need = [];
    for (const pid of poolIds) {
      const c = (byOrder.get(o.order_id) || {})[pid] || { allocated_units: 0, max_units: 0 };
      alloc.push(c.allocated_units);
      max.push(c.max_units);
      need.push(c.max_units - c.allocated_units);
    }
    return { order_id: o.order_id, product_name: o.product_name, alloc, max, need };
  });

  return {
    pools: pools.map((p) => ({ pool_id: p.pool_id, pool_name: p.pool_name, available_units: p.available_units })),
    orders: outOrders,
  };
}

// --------------------------- Orders for scheduling -------------------------
async function getReadyOrders() {
  const orders = (await listOrders()).filter((o) => o.status !== 'COMPLETED');
  return orders.map((o) => ({
    pid: o.order_id,
    product_name: o.product_name,
    arrival: o.arrival_time,
    burst: o.execution_time,
    priority: o.priority,
    deadline: o.deadline,
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
    const [rows] = await q('SELECT * FROM v_schedule_summary ORDER BY created_at DESC LIMIT ?', [limit]);
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

// ------------------------------- Audit log ---------------------------------
async function listAudit(limit = 20) {
  if (isMysql()) {
    const [rows] = await q('SELECT entity, entity_id, action, details, created_at FROM audit_log ORDER BY created_at DESC, log_id DESC LIMIT ?', [limit]);
    return rows;
  }
  return memData().auditLog.slice(-limit).reverse();
}

// ------------------------------- Dashboard ---------------------------------
async function dashboardStats() {
  const orders = await listOrders();
  const machines = await listMachines();
  const inventory = await listInventory();
  const byStatus = { READY: 0, RUNNING: 0, BLOCKED: 0, COMPLETED: 0 };
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  return {
    totalOrders: orders.length,
    ordersByStatus: byStatus,
    totalMachines: machines.length,
    machinesAvailable: machines.filter((m) => m.status === 'AVAILABLE').length,
    machinesMaintenance: machines.filter((m) => m.status === 'MAINTENANCE').length,
    lowStock: inventory.filter((m) => m.quantity_available <= m.reorder_level).length,
  };
}

module.exports = {
  findUserByUsername, findUserByEmail, createUser,
  listOrders, getOrder, addOrder, updateOrderStatus, deleteOrder,
  listMachines, updateMachineStatus, addMachine,
  listWorkers, addWorker,
  listInventory, updateInventoryQty, addInventoryItem,
  listPools, addPool,
  getBankersData, getReadyOrders,
  recordScheduleRun, listScheduleRuns,
  listAudit, dashboardStats,
};
