// Production orders: creating them, moving them between states, and the
// machine + worker an order holds while it runs.
const { now } = require('../memoryStore');
const {
  memData, isMysql, q, httpError, WORKERS_POOL, slotPoolName, usesPool, lockPools, assertTransition,
  recomputePools, memRecomputePools, inTransaction,
} = require('./shared');
const { syncFactoryPools } = require('./pools');

// ------------------------------- Materials ---------------------------------
// What the given orders use, as Map(order_id -> [{ material_id, material_name, unit, quantity }]).
// Only the asked-for orders are read, so a long history doesn't slow down a lookup.
async function materialsByOrder(orderIds) {
  if (!orderIds.length) return new Map();
  let rows;
  if (isMysql()) {
    [rows] = await q(
      `SELECT om.order_id, om.material_id, om.quantity, i.material_name, i.unit
       FROM order_materials om JOIN inventory i ON i.material_id = om.material_id
       WHERE om.order_id IN (?)
       ORDER BY om.order_id, i.material_name`,
      [orderIds]
    );
  } else {
    const d = memData();
    rows = d.orderMaterials.filter((m) => orderIds.includes(m.order_id))
      .map((m) => ({ ...m, ...d.inventory.find((i) => i.material_id === m.material_id) }));
  }
  const byOrder = new Map();
  for (const r of rows) {
    if (!byOrder.has(r.order_id)) byOrder.set(r.order_id, []);
    byOrder.get(r.order_id).push({ material_id: r.material_id, material_name: r.material_name, unit: r.unit, quantity: r.quantity });
  }
  return byOrder;
}

const withMaterials = (order, byOrder) => ({
  ...order,
  materials_taken: Boolean(order.materials_taken),
  materials: byOrder.get(order.order_id) || [],
});

// Sets the materials an order uses. A material that doesn't exist is a
// foreign-key error in MySQL, which the app turns into a 400.
// Every statement names a whole primary key (order_id AND material_id). A
// "DELETE ... WHERE order_id = ?" would lock the index range around it, and two
// orders being created at once then deadlock each other. The caller holds the
// order's row lock, so nobody else is changing these rows.
async function setMaterialsTx(conn, orderId, materials, isNew = false) {
  if (!isNew) {
    const [existing] = await conn.query('SELECT material_id FROM order_materials WHERE order_id = ?', [orderId]);
    const keep = new Set(materials.map((m) => m.material_id));
    for (const { material_id } of existing) {
      if (!keep.has(material_id)) await conn.query('DELETE FROM order_materials WHERE order_id = ? AND material_id = ?', [orderId, material_id]);
    }
  }
  for (const m of materials) {
    await conn.query(
      'INSERT INTO order_materials (order_id, material_id, quantity) VALUES (?,?,?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)',
      [orderId, m.material_id, m.quantity]
    );
  }
}

function memSetMaterials(d, orderId, materials) {
  for (const m of materials) {
    if (!d.inventory.some((i) => i.material_id === m.material_id)) throw httpError(400, 'One of those materials does not exist.');
  }
  d.orderMaterials = d.orderMaterials.filter((m) => m.order_id !== orderId);
  for (const m of materials) d.orderMaterials.push({ order_id: orderId, material_id: m.material_id, quantity: m.quantity });
}

const shortage = (rows) => rows
  .filter((r) => r.quantity_available < r.quantity)
  .map((r) => `${r.material_name}: needs ${r.quantity}, ${r.quantity_available} in stock`);

// Takes an order's materials out of stock, once, when it first starts. A
// shortage stops the order from starting at all. Runs after the machine and
// worker are claimed, so locks are always taken in the same order.
async function takeMaterialsTx(conn, order) {
  if (order.materials_taken) return;
  const [needs] = await conn.query(
    `SELECT om.material_id, om.quantity, i.material_name, i.quantity_available
     FROM order_materials om JOIN inventory i ON i.material_id = om.material_id
     WHERE om.order_id = ? ORDER BY om.material_id FOR UPDATE`,
    [order.order_id]
  );
  const missing = shortage(needs);
  if (missing.length) throw httpError(409, `Not enough stock to start. ${missing.join('; ')}.`);
  for (const n of needs) {
    await conn.query('UPDATE inventory SET quantity_available = quantity_available - ? WHERE material_id = ?', [n.quantity, n.material_id]);
  }
  await conn.query('UPDATE production_orders SET materials_taken = TRUE WHERE order_id = ?', [order.order_id]);
}

function memTakeMaterials(d, order) {
  if (order.materials_taken) return null;
  const needs = d.orderMaterials.filter((m) => m.order_id === order.order_id)
    .map((m) => ({ ...m, ...d.inventory.find((i) => i.material_id === m.material_id) }));
  const missing = shortage(needs);
  if (missing.length) throw httpError(409, `Not enough stock to start. ${missing.join('; ')}.`);
  return () => {
    for (const n of needs) d.inventory.find((i) => i.material_id === n.material_id).quantity_available -= n.quantity;
    order.materials_taken = true;
  };
}

// -------------------------------- Orders -----------------------------------
// Orders, oldest first. Finished orders pile up for ever and are rarely looked at,
// so callers can ask for less:
//   { statuses: ['READY', 'RUNNING'] }  only orders in those states
//   { recentFinished: 25 }              every unfinished order, plus the newest 25 finished ones
// With no options, everything.
async function listOrders({ statuses, recentFinished } = {}) {
  if (isMysql()) {
    const where = [];
    const params = [];
    if (statuses) {
      where.push('o.status IN (?)');
      params.push(statuses);
    } else if (recentFinished != null) {
      where.push(`(o.status <> 'COMPLETED' OR o.order_id IN
        (SELECT order_id FROM (SELECT order_id FROM production_orders WHERE status = 'COMPLETED' ORDER BY order_id DESC LIMIT ?) recent))`);
      params.push(recentFinished);
    }
    const [rows] = await q(
      `SELECT o.*, m.machine_name AS assigned_machine, w.full_name AS assigned_worker
       FROM production_orders o
       LEFT JOIN resource_allocations a ON a.order_id = o.order_id AND a.status = 'ALLOCATED'
       LEFT JOIN machines m ON m.machine_id = a.machine_id
       LEFT JOIN workers  w ON w.worker_id  = a.worker_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY o.order_id`,
      params
    );
    const byOrder = await materialsByOrder(rows.map((o) => o.order_id));
    return rows.map((o) => withMaterials(o, byOrder));
  }
  const d = memData();
  let list = d.orders;
  if (statuses) list = list.filter((o) => statuses.includes(o.status));
  else if (recentFinished != null) {
    const finished = list.filter((o) => o.status === 'COMPLETED');
    const keep = new Set((recentFinished > 0 ? finished.slice(-recentFinished) : []).map((o) => o.order_id));
    list = list.filter((o) => o.status !== 'COMPLETED' || keep.has(o.order_id));
  }
  const byOrder = await materialsByOrder(list.map((o) => o.order_id));
  return list.map((o) => {
    const a = d.allocations.find((x) => x.order_id === o.order_id && x.status === 'ALLOCATED');
    return withMaterials({
      ...o,
      assigned_machine: a ? d.machines.find((m) => m.machine_id === a.machine_id)?.machine_name : null,
      assigned_worker: a ? d.workers.find((w) => w.worker_id === a.worker_id)?.full_name : null,
    }, byOrder);
  });
}

// How many orders are in each state, without reading the orders themselves.
async function countOrdersByStatus() {
  const counts = { READY: 0, RUNNING: 0, BLOCKED: 0, COMPLETED: 0 };
  if (isMysql()) {
    const [rows] = await q('SELECT status, COUNT(*) AS n FROM production_orders GROUP BY status');
    for (const r of rows) counts[r.status] = Number(r.n);
  } else {
    for (const o of memData().orders) counts[o.status] += 1;
  }
  return counts;
}

async function getOrder(id) {
  let order;
  if (isMysql()) {
    const [rows] = await q('SELECT * FROM production_orders WHERE order_id = ?', [id]);
    order = rows[0];
  } else {
    order = memData().orders.find((o) => o.order_id === id);
  }
  return order ? withMaterials(order, await materialsByOrder([id])) : null;
}

async function addOrder(data) {
  const { product_name, quantity, arrival_time, execution_time, priority, deadline, required_machine_type, materials = [] } = data;
  if (isMysql()) {
    const orderId = await inTransaction(async (conn) => {
      await lockPools(conn);
      const [res] = await conn.query(
        `INSERT INTO production_orders
         (product_name, quantity, arrival_time, execution_time, priority, deadline, required_machine_type)
         VALUES (?,?,?,?,?,?,?)`,
        [product_name, quantity, arrival_time, execution_time, priority, deadline, required_machine_type]
      );
      // default claim row per pool so the order joins the Banker's matrix
      await conn.query(
        `INSERT INTO order_resource_claims (order_id, pool_id, allocated_units, max_units)
         SELECT ?, pool_id, 0,
                CASE WHEN auto_managed AND (pool_name = ? OR pool_name = CONCAT(?, ' slots')) THEN 1 ELSE 0 END
         FROM resource_pools`,
        [res.insertId, WORKERS_POOL, required_machine_type]
      );
      await setMaterialsTx(conn, res.insertId, materials, true);
      return res.insertId;
    });
    return getOrder(orderId);
  }
  const d = memData();
  const order_id = ++d.seq.order;
  memSetMaterials(d, order_id, materials);
  const order = { order_id, product_name, quantity, arrival_time, execution_time, priority, deadline, required_machine_type, status: 'READY', materials_taken: false, created_at: now() };
  d.orders.push(order);
  for (const p of d.pools) d.claims.push({ order_id, pool_id: p.pool_id, allocated_units: 0, requested_units: 0, max_units: usesPool(p, required_machine_type) ? 1 : 0 });
  return getOrder(order_id);
}

const noMachineMessage = (order) => (order.required_machine_type
  ? `No free machine of type ${order.required_machine_type}. Wait for a running order to finish.`
  : 'No free machine. Wait for a running order to finish.');
const noWorkerMessage = (order) => (order.required_machine_type
  ? `No free worker is trained for ${order.required_machine_type}. Wait for a running order to finish.`
  : 'No free worker. Wait for a running order to finish.');

// Claim one machine slot and one worker trained for it, inside the caller's
// transaction. Machine and worker rows are locked in that order everywhere, so
// two orders starting together can't both take the last slot or deadlock.
async function allocateTx(conn, order) {
  const typed = order.required_machine_type ? ' AND machine_type = ?' : '';
  const [machines] = await conn.query(
    `SELECT machine_id, capacity, machine_type FROM machines
     WHERE status <> 'MAINTENANCE'${typed} ORDER BY machine_id FOR UPDATE`,
    typed ? [order.required_machine_type] : []
  );
  const [active] = await conn.query(
    `SELECT machine_id, COUNT(*) AS used FROM resource_allocations
     WHERE status = 'ALLOCATED' AND machine_id IS NOT NULL GROUP BY machine_id`
  );
  const used = new Map(active.map((a) => [a.machine_id, a.used]));
  const free = machines.filter((m) => (used.get(m.machine_id) || 0) < m.capacity);
  if (!free.length) throw httpError(409, noMachineMessage(order));

  // A worker fits a machine if trained for its type or for any machine; one
  // trained for exactly that type is preferred, so generalists stay free.
  let machine = null, worker = null;
  for (const m of free) {
    const [found] = await conn.query(
      `SELECT worker_id FROM workers
       WHERE status = 'AVAILABLE' AND (machine_type IS NULL OR machine_type = ?)
       ORDER BY (machine_type IS NULL), worker_id LIMIT 1 FOR UPDATE`,
      [m.machine_type]
    );
    if (found.length) { machine = m; worker = found[0]; break; }
  }
  if (!machine) throw httpError(409, noWorkerMessage(order));

  // Show the claim in the Banker's matrix too, so it reflects what's really held.
  // Every read here locks, because this transaction's snapshot is already older
  // than the pool rows it may just have waited for.
  const [pools] = await conn.query(
    'SELECT pool_id, pool_name, auto_managed, available_units FROM resource_pools ORDER BY pool_id FOR UPDATE'
  );
  for (const pool of pools.filter((p) => usesPool(p, machine.machine_type))) {
    const [[claim]] = await conn.query(
      'SELECT allocated_units FROM order_resource_claims WHERE order_id = ? AND pool_id = ? FOR UPDATE',
      [order.order_id, pool.pool_id]
    );
    if (!claim?.allocated_units && pool.available_units < 1) {
      throw httpError(409, `All ${pool.pool_name} are reserved on the Safety & Deadlock page.`);
    }
    await conn.query(
      `INSERT INTO order_resource_claims (order_id, pool_id, allocated_units, max_units) VALUES (?, ?, 1, 1)
       ON DUPLICATE KEY UPDATE allocated_units = GREATEST(allocated_units, 1), max_units = GREATEST(max_units, 1)`,
      [order.order_id, pool.pool_id]
    );
  }
  await recomputePools(conn);

  await conn.query(
    `INSERT INTO resource_allocations (order_id, machine_id, worker_id, status) VALUES (?,?,?,'ALLOCATED')`,
    [order.order_id, machine.machine_id, worker.worker_id]
  );
  await conn.query(`UPDATE workers SET status = 'ASSIGNED' WHERE worker_id = ?`, [worker.worker_id]);
  if ((used.get(machine.machine_id) || 0) + 1 >= machine.capacity) {
    await conn.query(`UPDATE machines SET status = 'BUSY' WHERE machine_id = ?`, [machine.machine_id]);
  }
}

// Give back whatever an order holds, inside the caller's transaction.
async function releaseTx(conn, orderId) {
  const [held] = await conn.query(
    `SELECT allocation_id, machine_id, worker_id FROM resource_allocations
     WHERE order_id = ? AND status = 'ALLOCATED'`,
    [orderId]
  );
  for (const a of held) {
    await conn.query(`UPDATE machines SET status = 'AVAILABLE' WHERE machine_id = ? AND status = 'BUSY'`, [a.machine_id]);
    await conn.query(`UPDATE workers SET status = 'AVAILABLE' WHERE worker_id = ? AND status = 'ASSIGNED'`, [a.worker_id]);
    await conn.query(`UPDATE resource_allocations SET status = 'RELEASED' WHERE allocation_id = ?`, [a.allocation_id]);
  }
  await lockPools(conn);
  await conn.query('UPDATE order_resource_claims SET allocated_units = 0, requested_units = 0 WHERE order_id = ?', [orderId]);
  await recomputePools(conn);
}

function memAllocate(d, order) {
  const fits = (m) => m.status !== 'MAINTENANCE'
    && (!order.required_machine_type || m.machine_type.toLowerCase() === order.required_machine_type.toLowerCase());
  const usedBy = (m) => d.allocations.filter((a) => a.machine_id === m.machine_id && a.status === 'ALLOCATED').length;
  const free = d.machines.filter((m) => fits(m) && usedBy(m) < m.capacity);
  if (!free.length) throw httpError(409, noMachineMessage(order));
  let machine = null, worker = null;
  for (const m of free) {
    const trained = (w) => !w.machine_type || w.machine_type.toLowerCase() === m.machine_type.toLowerCase();
    const candidates = d.workers.filter((w) => w.status === 'AVAILABLE' && trained(w));
    const found = candidates.find((w) => w.machine_type) || candidates[0];
    if (found) { machine = m; worker = found; break; }
  }
  if (!machine) throw httpError(409, noWorkerMessage(order));

  for (const pool of d.pools.filter((p) => usesPool(p, machine.machine_type))) {
    let claim = d.claims.find((c) => c.order_id === order.order_id && c.pool_id === pool.pool_id);
    if (!claim?.allocated_units && pool.available_units < 1) {
      throw httpError(409, `All ${pool.pool_name} are reserved on the Safety & Deadlock page.`);
    }
    if (!claim) {
      claim = { order_id: order.order_id, pool_id: pool.pool_id, allocated_units: 0, requested_units: 0, max_units: 1 };
      d.claims.push(claim);
    }
    claim.allocated_units = Math.max(claim.allocated_units, 1);
    claim.max_units = Math.max(claim.max_units, 1);
  }
  memRecomputePools(d);

  d.allocations.push({ allocation_id: ++d.seq.allocation, order_id: order.order_id, machine_id: machine.machine_id, worker_id: worker.worker_id, status: 'ALLOCATED' });
  worker.status = 'ASSIGNED';
  if (usedBy(machine) >= machine.capacity) machine.status = 'BUSY';
}

function memRelease(d, orderId) {
  for (const a of d.allocations.filter((x) => x.order_id === orderId && x.status === 'ALLOCATED')) {
    const machine = d.machines.find((m) => m.machine_id === a.machine_id);
    const worker = d.workers.find((w) => w.worker_id === a.worker_id);
    if (machine?.status === 'BUSY') machine.status = 'AVAILABLE';
    if (worker?.status === 'ASSIGNED') worker.status = 'AVAILABLE';
    a.status = 'RELEASED';
  }
  for (const c of d.claims.filter((x) => x.order_id === orderId)) {
    c.allocated_units = 0;
    c.requested_units = 0;
  }
  memRecomputePools(d);
}

// Moving an order to RUNNING claims a machine and a worker (409 if none is
// free); moving it to any other state gives them back.
async function updateOrderStatus(id, status) {
  await syncFactoryPools();
  if (isMysql()) {
    await inTransaction(async (conn) => {
      const [[order]] = await conn.query('SELECT * FROM production_orders WHERE order_id = ? FOR UPDATE', [id]);
      if (!order) throw httpError(404, 'Order not found.');
      if (order.status === status) return;
      assertTransition(order.status, status);
      if (status === 'RUNNING') {
        await allocateTx(conn, order);
        await takeMaterialsTx(conn, order);
      } else {
        await releaseTx(conn, id);
      }
      await conn.query('UPDATE production_orders SET status = ? WHERE order_id = ?', [status, id]);
    });
    return getOrder(id);
  }
  const d = memData();
  const o = d.orders.find((x) => x.order_id === id);
  if (!o) throw httpError(404, 'Order not found.');
  if (o.status === status) return o;
  assertTransition(o.status, status);
  if (status === 'RUNNING') {
    const take = memTakeMaterials(d, o);   // checks stock first, so a shortage changes nothing
    memAllocate(d, o);
    if (take) take();
  } else {
    memRelease(d, id);
  }
  o.status = status;
  return o;
}

// Deadlock recovery: preempt an order, taking back everything it holds. A
// running order returns to READY, because it no longer has a machine or worker.
async function preemptOrder(id) {
  if (isMysql()) {
    await inTransaction(async (conn) => {
      const [[order]] = await conn.query('SELECT status FROM production_orders WHERE order_id = ? FOR UPDATE', [id]);
      if (!order) throw httpError(404, 'Order not found.');
      await releaseTx(conn, id);
      if (order.status === 'RUNNING') await conn.query(`UPDATE production_orders SET status = 'READY' WHERE order_id = ?`, [id]);
    });
    return;
  }
  const d = memData();
  const o = d.orders.find((x) => x.order_id === id);
  if (!o) throw httpError(404, 'Order not found.');
  memRelease(d, id);
  if (o.status === 'RUNNING') o.status = 'READY';
}

// Cascades delete the order's claims without firing triggers, so its units
// have to be handed back explicitly first.
async function deleteOrder(id) {
  if (isMysql()) {
    await inTransaction(async (conn) => {
      const [[order]] = await conn.query('SELECT order_id FROM production_orders WHERE order_id = ? FOR UPDATE', [id]);
      if (!order) throw httpError(404, 'Order not found.');
      await releaseTx(conn, id);
      await conn.query('DELETE FROM production_orders WHERE order_id = ?', [id]);
    });
    return;
  }
  const d = memData();
  if (!d.orders.some((o) => o.order_id === id)) throw httpError(404, 'Order not found.');
  memRelease(d, id);
  d.allocations = d.allocations.filter((a) => a.order_id !== id);
  d.orders = d.orders.filter((o) => o.order_id !== id);
  d.claims = d.claims.filter((c) => c.order_id !== id);
}

// ------------------------------- Editing -----------------------------------
// The details of an order can be changed until it is COMPLETED. Some changes
// have rules: the machine type can't change while the order runs or holds units
// (the Banker's claims would no longer match), and its materials can't change
// once they have been taken out of stock.
const EDITABLE = ['product_name', 'quantity', 'arrival_time', 'execution_time', 'priority', 'deadline', 'required_machine_type'];
const sameType = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
const SLOT_POOL = (pool) => pool.auto_managed && / slots$/i.test(pool.pool_name);

async function updateOrder(id, fields, materials) {
  const changes = Object.entries(fields).filter(([key]) => EDITABLE.includes(key));
  const typeChanges = (order) => 'required_machine_type' in fields && !sameType(fields.required_machine_type, order.required_machine_type);

  if (isMysql()) {
    await syncFactoryPools();
    await inTransaction(async (conn) => {
      const [[order]] = await conn.query('SELECT * FROM production_orders WHERE order_id = ? FOR UPDATE', [id]);
      if (!order) throw httpError(404, 'Order not found.');
      if (order.status === 'COMPLETED') throw httpError(409, "A finished order can't be edited.");

      if (typeChanges(order)) {
        if (order.status === 'RUNNING') throw httpError(409, 'Stop the order before changing its machine type.');
        await lockPools(conn);
        const [[{ held }]] = await conn.query(
          `SELECT IFNULL(SUM(c.allocated_units), 0) AS held FROM order_resource_claims c
           JOIN resource_pools p ON p.pool_id = c.pool_id
           WHERE c.order_id = ? AND p.auto_managed AND p.pool_name LIKE '% slots'`, [id]
        );
        if (Number(held) > 0) throw httpError(409, 'Release the units this order holds before changing its machine type.');
        // Its Maximum of one machine slot moves to the new type's pool.
        await conn.query(
          `UPDATE order_resource_claims c JOIN resource_pools p ON p.pool_id = c.pool_id
           SET c.max_units = IF(p.pool_name = CONCAT(?, ' slots'), 1, 0), c.requested_units = 0
           WHERE c.order_id = ? AND p.auto_managed AND p.pool_name LIKE '% slots'`,
          [fields.required_machine_type || null, id]
        );
      }
      if (materials) {
        if (order.materials_taken) throw httpError(409, 'The materials for this order have already been used, so they cannot change.');
        await setMaterialsTx(conn, id, materials);
      }
      if (changes.length) {
        await conn.query(
          `UPDATE production_orders SET ${changes.map(([key]) => `${key} = ?`).join(', ')} WHERE order_id = ?`,
          [...changes.map(([, value]) => value), id]
        );
      }
    });
    return getOrder(id);
  }

  const d = memData();
  const order = d.orders.find((o) => o.order_id === id);
  if (!order) throw httpError(404, 'Order not found.');
  if (order.status === 'COMPLETED') throw httpError(409, "A finished order can't be edited.");
  if (typeChanges(order)) {
    if (order.status === 'RUNNING') throw httpError(409, 'Stop the order before changing its machine type.');
    const slotPools = d.pools.filter(SLOT_POOL);
    const claims = d.claims.filter((c) => c.order_id === id && slotPools.some((p) => p.pool_id === c.pool_id));
    if (claims.some((c) => c.allocated_units > 0)) throw httpError(409, 'Release the units this order holds before changing its machine type.');
    for (const c of claims) {
      const pool = slotPools.find((p) => p.pool_id === c.pool_id);
      c.max_units = fields.required_machine_type && sameType(pool.pool_name, slotPoolName(fields.required_machine_type)) ? 1 : 0;
      c.requested_units = 0;
    }
  }
  if (materials) {
    if (order.materials_taken) throw httpError(409, 'The materials for this order have already been used, so they cannot change.');
    memSetMaterials(d, id, materials);
  }
  for (const [key, value] of changes) order[key] = value;
  return getOrder(id);
}

module.exports = { listOrders, countOrdersByStatus, addOrder, updateOrder, updateOrderStatus, preemptOrder, deleteOrder };
