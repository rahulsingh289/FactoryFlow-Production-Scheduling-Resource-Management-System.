// Resource pools: the Banker's Algorithm's resource types. Slots and workers
// are kept in step with the real factory; others can be added by hand.
const { memData, isMysql, q, httpError, WORKERS_POOL, slotPoolName, samePoolName, usesPool, lockPools, inTransaction } = require('./shared');

async function listPools() {
  await syncFactoryPools();
  if (isMysql()) { const [rows] = await q('SELECT * FROM resource_pools ORDER BY pool_id'); return rows; }
  return [...memData().pools];
}

// The auto-managed pools mirror the real factory: machines not in maintenance
// give slots per type, and workers on shift give the Workers pool.
function factoryPoolTotals(machines, workers) {
  const byType = new Map();
  for (const m of machines) {
    const key = m.machine_type.toLowerCase();
    const entry = byType.get(key) || { pool_name: slotPoolName(m.machine_type), total: 0 };
    if (m.status !== 'MAINTENANCE') entry.total += m.capacity;
    byType.set(key, entry);
  }
  const totals = [...byType.values()];
  if (workers.length) totals.push({ pool_name: WORKERS_POOL, total: workers.filter((w) => w.status !== 'OFF_SHIFT').length });
  return totals;
}

// What has to change for the pools to match the factory. A total never drops
// below what's already allocated, and a pool still in use is never removed.
function planPoolChanges(pools, totals) {
  const add = [], update = [];
  for (const { pool_name, total } of totals) {
    const pool = pools.find((p) => samePoolName(p.pool_name, pool_name));
    if (!pool) { add.push({ pool_name, total }); continue; }
    const used = Number(pool.used);
    const newTotal = Math.max(total, used);
    if (newTotal !== pool.total_units || newTotal - used !== pool.available_units || !pool.auto_managed) {
      update.push({ pool_id: pool.pool_id, total: newTotal, available: newTotal - used });
    }
  }
  const remove = pools.filter((p) => p.auto_managed && Number(p.used) === 0
    && !totals.some((t) => samePoolName(t.pool_name, p.pool_name)));
  return { add, update, remove };
}

async function readPoolPlan(run) {
  const [machines] = await run('SELECT machine_type, capacity, status FROM machines');
  const [workers] = await run('SELECT status FROM workers');
  const [pools] = await run(
    `SELECT p.pool_id, p.pool_name, p.total_units, p.available_units, p.auto_managed,
            IFNULL(SUM(c.allocated_units), 0) AS used
     FROM resource_pools p LEFT JOIN order_resource_claims c ON c.pool_id = p.pool_id AND c.allocated_units > 0
     GROUP BY p.pool_id`
  );
  return planPoolChanges(pools, factoryPoolTotals(machines, workers));
}

// Every active order gets a claim row for every pool, including pools newer than it.
const MISSING_CLAIMS = `
  SELECT o.order_id, p.pool_id,
         CASE WHEN p.auto_managed AND (p.pool_name = ? OR p.pool_name = CONCAT(o.required_machine_type, ' slots')) THEN 1 ELSE 0 END AS max_units
  FROM production_orders o
  CROSS JOIN resource_pools p
  LEFT JOIN order_resource_claims c ON c.order_id = o.order_id AND c.pool_id = p.pool_id
  WHERE o.status <> 'COMPLETED' AND c.order_id IS NULL`;

async function syncFactoryPools() {
  if (!isMysql()) return memSyncFactoryPools(memData());

  // Nearly every call finds nothing to do, so look first without taking locks.
  const plan = await readPoolPlan(q);
  const [[{ missing }]] = await q(`SELECT COUNT(*) AS missing FROM (${MISSING_CLAIMS}) m`, [WORKERS_POOL]);
  if (!plan.add.length && !plan.update.length && !plan.remove.length && !missing) return;

  await inTransaction(async (conn) => {
    await lockPools(conn);
    const { add, update, remove } = await readPoolPlan((sql) => conn.query(sql));
    for (const p of add) {
      await conn.query(
        'INSERT INTO resource_pools (pool_name, total_units, available_units, auto_managed) VALUES (?, ?, ?, TRUE)',
        [p.pool_name, p.total, p.total]
      );
    }
    for (const p of update) {
      await conn.query(
        'UPDATE resource_pools SET total_units = ?, available_units = ?, auto_managed = TRUE WHERE pool_id = ?',
        [p.total, p.available, p.pool_id]
      );
    }
    for (const p of remove) await conn.query('DELETE FROM resource_pools WHERE pool_id = ?', [p.pool_id]);
    await conn.query(
      `INSERT IGNORE INTO order_resource_claims (order_id, pool_id, allocated_units, max_units)
       SELECT order_id, pool_id, 0, max_units FROM (${MISSING_CLAIMS}) m`,
      [WORKERS_POOL]
    );
  });
}

function memSyncFactoryPools(d) {
  const pools = d.pools.map((p) => ({
    ...p,
    used: d.claims.filter((c) => c.pool_id === p.pool_id).reduce((sum, c) => sum + c.allocated_units, 0),
  }));
  const { add, update, remove } = planPoolChanges(pools, factoryPoolTotals(d.machines, d.workers));
  for (const p of add) d.pools.push({ pool_id: ++d.seq.pool, pool_name: p.pool_name, total_units: p.total, available_units: p.total, auto_managed: true });
  for (const p of update) Object.assign(d.pools.find((x) => x.pool_id === p.pool_id), { total_units: p.total, available_units: p.available, auto_managed: true });
  const removed = new Set(remove.map((p) => p.pool_id));
  d.pools = d.pools.filter((p) => !removed.has(p.pool_id));
  d.claims = d.claims.filter((c) => !removed.has(c.pool_id));
  for (const o of d.orders.filter((x) => x.status !== 'COMPLETED')) {
    for (const p of d.pools) {
      if (!d.claims.some((c) => c.order_id === o.order_id && c.pool_id === p.pool_id)) {
        d.claims.push({ order_id: o.order_id, pool_id: p.pool_id, allocated_units: 0, requested_units: 0, max_units: usesPool(p, o.required_machine_type) ? 1 : 0 });
      }
    }
  }
}

async function addPool({ pool_name, total_units }) {
  if (isMysql()) {
    const [r] = await q('INSERT INTO resource_pools (pool_name, total_units, available_units) VALUES (?,?,?)',
      [pool_name, total_units, total_units]);
    return { pool_id: r.insertId, pool_name, total_units, available_units: total_units };
  }
  const d = memData();
  const p = { pool_id: ++d.seq.pool, pool_name, total_units, available_units: total_units };
  d.pools.push(p); return p;
}

// Only pools added by hand can be removed. Machine slots and workers follow the
// factory, and a pool an order still holds units of has to be released first.
async function deletePool(id) {
  const autoError = () => httpError(409, 'This pool follows your machines and workers, so it can\'t be deleted.');
  const heldError = () => httpError(409, 'An order still holds units of this pool. Release them first.');
  if (isMysql()) {
    await inTransaction(async (conn) => {
      await lockPools(conn);
      const [[pool]] = await conn.query('SELECT auto_managed FROM resource_pools WHERE pool_id = ?', [id]);
      if (!pool) throw httpError(404, 'Pool not found.');
      if (pool.auto_managed) throw autoError();
      const [[{ held }]] = await conn.query('SELECT IFNULL(SUM(allocated_units), 0) AS held FROM order_resource_claims WHERE pool_id = ?', [id]);
      if (Number(held) > 0) throw heldError();
      await conn.query('DELETE FROM resource_pools WHERE pool_id = ?', [id]);
    });
    return;
  }
  const d = memData();
  const pool = d.pools.find((p) => p.pool_id === id);
  if (!pool) throw httpError(404, 'Pool not found.');
  if (pool.auto_managed) throw autoError();
  if (d.claims.some((c) => c.pool_id === id && c.allocated_units > 0)) throw heldError();
  d.pools = d.pools.filter((p) => p.pool_id !== id);
  d.claims = d.claims.filter((c) => c.pool_id !== id);
}

module.exports = { listPools, syncFactoryPools, addPool, deletePool };
