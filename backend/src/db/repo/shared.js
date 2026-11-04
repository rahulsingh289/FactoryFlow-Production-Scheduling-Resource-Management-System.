// ---------------------------------------------------------------------------
// Pieces every repository module uses: which database is active, the
// in-memory store, transactions, and the Banker's pool bookkeeping.
// ---------------------------------------------------------------------------
const { state } = require('../index');
const { freshData } = require('../memoryStore');

let mem = null; // in-memory data, created lazily
function memData() {
  if (!mem) mem = freshData();
  return mem;
}
const isMysql = () => state.mode === 'mysql';
const q = (sql, params) => state.pool.query(sql, params);

// An error the API should show to the client as-is, with this HTTP status.
const httpError = (status, message) => Object.assign(new Error(message), { status });

// Banker's resources kept in step with the factory: one pool of slots per
// machine type, and one pool of workers.
const WORKERS_POOL = 'Workers';
const slotPoolName = (machineType) => `${machineType} slots`;
const samePoolName = (a, b) => a.toLowerCase() === b.toLowerCase();
// Does an order on this machine type use this pool?
const usesPool = (pool, machineType) => Boolean(pool.auto_managed)
  && (samePoolName(pool.pool_name, WORKERS_POOL) || samePoolName(pool.pool_name, slotPoolName(machineType)));

// Every transaction locks in the same order, so two can't wait on each other:
// order -> machines -> workers -> pools -> claims.
const lockPools = (conn) => conn.query('SELECT pool_id FROM resource_pools ORDER BY pool_id FOR UPDATE');

// Process states: an order can only move along these edges, and COMPLETED is final.
const NEXT_STATES = {
  READY: ['RUNNING', 'BLOCKED'],
  RUNNING: ['READY', 'BLOCKED', 'COMPLETED'],
  BLOCKED: ['READY'],
  COMPLETED: [],
};
function assertTransition(from, to) {
  if (from !== to && !NEXT_STATES[from].includes(to)) {
    throw httpError(409, `An order can't go from ${from} to ${to}.`);
  }
}

// available = total - everything allocated. Triggers keep this up to date too;
// recomputing makes it correct even on a database without them. Only claims that
// hold something are added up (idx_claim_held), because this runs while every
// pool is locked and finished orders leave thousands of all-zero rows behind.
async function recomputePools(conn) {
  await conn.query(
    `UPDATE resource_pools p
     LEFT JOIN (SELECT pool_id, SUM(allocated_units) AS used FROM order_resource_claims
                WHERE allocated_units > 0 GROUP BY pool_id) c
       ON c.pool_id = p.pool_id
     SET p.available_units = GREATEST(p.total_units - IFNULL(c.used, 0), 0)`
  );
}

// If the database picks this transaction as a deadlock victim it has already
// undone everything, so it's safe to simply run it again.
const DEADLOCK_ATTEMPTS = 5;

async function inTransaction(work) {
  for (let attempt = 1; ; attempt++) {
    const conn = await state.pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await work(conn);
      await conn.commit();
      return result;
    } catch (e) {
      await conn.rollback();
      if (e.code !== 'ER_LOCK_DEADLOCK' || attempt === DEADLOCK_ATTEMPTS) throw e;
    } finally {
      conn.release();
    }
    // A short, random pause so two transactions that just collided don't
    // retry in lockstep and collide again.
    await new Promise((resolve) => setTimeout(resolve, 5 + Math.random() * 25));
  }
}

function memRecomputePools(d) {
  for (const p of d.pools) {
    const used = d.claims.filter((c) => c.pool_id === p.pool_id).reduce((sum, c) => sum + c.allocated_units, 0);
    p.available_units = Math.max(p.total_units - used, 0);
  }
}

module.exports = { state, memData, isMysql, q, httpError, WORKERS_POOL, slotPoolName, samePoolName, usesPool, lockPools, assertTransition, recomputePools, memRecomputePools, inTransaction };
