// Banker's Algorithm data: the Allocation / Maximum / Need / Request matrices,
// and the locked read-modify-write steps that change them.
const {
  memData, isMysql, q, httpError, lockPools, recomputePools, memRecomputePools, inTransaction,
} = require('./shared');
const { syncFactoryPools } = require('./pools');

// --------------------- Banker's / deadlock matrices ------------------------
// Returns { pools:[{pool_id,pool_name,total_units,available_units}],
//           orders:[{order_id,product_name,status,alloc:[..],max:[..],need:[..],request:[..]}] }
// Inside withPoolsLocked, pass its connection: the read then sees the locked rows
// and doesn't need a second connection while holding the first.
async function getBankersData({ conn = null } = {}) {
  if (!conn) await syncFactoryPools();
  const run = conn ? (sql) => conn.query(sql) : q;
  const pools = isMysql()
    ? (await run('SELECT * FROM resource_pools ORDER BY pool_id'))[0]
    : [...memData().pools].sort((a, b) => a.pool_id - b.pool_id);
  const poolIds = pools.map((p) => p.pool_id);

  // Finished orders hold nothing and want nothing, so they aren't processes any more.
  let orders, claimLookup;
  if (isMysql()) {
    const [os] = await run(
      `SELECT order_id, product_name, status FROM production_orders
       WHERE status <> 'COMPLETED' ORDER BY order_id`
    );
    orders = os;
    // Finished orders keep their claim rows, but hold and want nothing: skip them.
    const [claims] = await run(
      `SELECT c.order_id, c.pool_id, c.allocated_units, c.max_units, c.requested_units
       FROM order_resource_claims c JOIN production_orders o ON o.order_id = c.order_id
       WHERE o.status <> 'COMPLETED'`
    );
    claimLookup = claims;
  } else {
    const d = memData();
    orders = d.orders.filter((o) => o.status !== 'COMPLETED')
      .map((o) => ({ order_id: o.order_id, product_name: o.product_name, status: o.status }));
    claimLookup = d.claims;
  }

  const byOrder = new Map();
  for (const c of claimLookup) {
    if (!byOrder.has(c.order_id)) byOrder.set(c.order_id, {});
    byOrder.get(c.order_id)[c.pool_id] = c;
  }

  const outOrders = orders.map((o) => {
    const alloc = [], max = [], need = [], request = [];
    for (const pid of poolIds) {
      const c = (byOrder.get(o.order_id) || {})[pid] || { allocated_units: 0, max_units: 0, requested_units: 0 };
      alloc.push(c.allocated_units);
      max.push(c.max_units);
      need.push(c.max_units - c.allocated_units);
      request.push(c.requested_units || 0);
    }
    return { order_id: o.order_id, product_name: o.product_name, status: o.status, alloc, max, need, request };
  });

  return {
    pools: pools.map((p) => ({ pool_id: p.pool_id, pool_name: p.pool_name, total_units: p.total_units, available_units: p.available_units })),
    orders: outOrders,
  };
}

// Run `work` while holding the pool rows, so a Banker's decision can't be made
// on numbers another request is about to change.
async function withPoolsLocked(work) {
  if (!isMysql()) return work(null);
  return inTransaction(async (conn) => {
    await lockPools(conn);
    return work(conn);
  });
}

async function grantClaim(conn, orderId, poolIds, units) {
  if (conn) {
    for (let j = 0; j < poolIds.length; j++) {
      await conn.query(
        'UPDATE order_resource_claims SET allocated_units = allocated_units + ?, requested_units = 0 WHERE order_id = ? AND pool_id = ?',
        [units[j], orderId, poolIds[j]]
      );
    }
    await recomputePools(conn);
    return;
  }
  const d = memData();
  poolIds.forEach((poolId, j) => {
    const c = d.claims.find((x) => x.order_id === orderId && x.pool_id === poolId);
    c.allocated_units += units[j];
    c.requested_units = 0;
  });
  memRecomputePools(d);
}

async function recordWaitingRequest(conn, orderId, poolIds, units) {
  if (conn) {
    for (let j = 0; j < poolIds.length; j++) {
      await conn.query(
        'UPDATE order_resource_claims SET requested_units = ? WHERE order_id = ? AND pool_id = ?',
        [units[j], orderId, poolIds[j]]
      );
    }
    return;
  }
  const d = memData();
  poolIds.forEach((poolId, j) => {
    d.claims.find((x) => x.order_id === orderId && x.pool_id === poolId).requested_units = units[j];
  });
}

// A smaller Maximum also shrinks any waiting request that no longer fits inside it.
async function setClaimMax(orderId, poolId, maxUnits) {
  await withPoolsLocked(async (conn) => {
    const claim = conn
      ? (await conn.query('SELECT allocated_units FROM order_resource_claims WHERE order_id = ? AND pool_id = ? FOR UPDATE', [orderId, poolId]))[0][0]
      : memData().claims.find((c) => c.order_id === orderId && c.pool_id === poolId);
    const pool = conn
      ? (await conn.query('SELECT total_units FROM resource_pools WHERE pool_id = ?', [poolId]))[0][0]
      : memData().pools.find((p) => p.pool_id === poolId);
    if (!claim || !pool) throw httpError(404, 'That order or pool was not found.');
    if (maxUnits < claim.allocated_units) throw httpError(409, `Maximum can't be below the ${claim.allocated_units} already allocated.`);
    if (maxUnits > pool.total_units) throw httpError(409, `Maximum can't be above the ${pool.total_units} that exist.`);
    if (conn) {
      await conn.query(
        'UPDATE order_resource_claims SET max_units = ?, requested_units = LEAST(requested_units, ? - allocated_units) WHERE order_id = ? AND pool_id = ?',
        [maxUnits, maxUnits, orderId, poolId]
      );
    } else {
      claim.max_units = maxUnits;
      claim.requested_units = Math.min(claim.requested_units, maxUnits - claim.allocated_units);
    }
  });
}

module.exports = { getBankersData, withPoolsLocked, grantClaim, recordWaitingRequest, setClaimMax };
