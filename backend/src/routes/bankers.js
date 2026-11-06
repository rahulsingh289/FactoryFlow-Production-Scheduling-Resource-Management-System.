// Banker's Algorithm and deadlock endpoints. The algorithms run in the C++ engine.
const express = require('express');
const repo = require('../db/repo');
const engine = require('../services/engine');
const { manager, isPositiveInt } = require('./helpers');

const router = express.Router();

// A view-only account can look at the Banker's matrices and test a request
// ("check"), but only a manager can change them.
const managerOnly = (req, res, next) => (req.body?.action && req.body.action !== 'check' ? manager(req, res, next) : next());

// GET /api/os/bankers  -> current safe-state check + matrix
router.get('/bankers', async (req, res, next) => {
  try {
    const data = await repo.getBankersData();
    const result = await engine.bankers(data);
    res.json({ ...data, ...result, sequenceNames: namesFor(data, result.sequence) });
  } catch (e) { next(e); }
});

// GET /api/os/safety  -> the safe-state check AND deadlock detection from one read
// of the matrices (the Safety page and Dashboard need both). The deadlock result
// is under `deadlock`.
router.get('/safety', async (req, res, next) => {
  try {
    const data = await repo.getBankersData();
    const [result, deadlock] = await Promise.all([engine.bankers(data), engine.deadlock(data)]);
    res.json({ ...data, ...result, sequenceNames: namesFor(data, result.sequence), deadlock });
  } catch (e) { next(e); }
});

// POST /api/os/bankers/request  { order_id, units:[..], action }
//   check  reports what would happen and changes nothing
//   grant  allocates if the system stays safe; otherwise the order waits
//   force  allocates without the safety check, which is how a deadlock can happen
// An order can never take more than its Maximum or more than is free.
router.post('/bankers/request', managerOnly, async (req, res, next) => {
  try {
    const action = req.body?.action ?? 'check';
    const order_id = Number(req.body?.order_id);
    const units = (Array.isArray(req.body?.units) ? req.body.units : []).map(Number);
    if (!['check', 'grant', 'force'].includes(action)) return res.status(400).json({ error: 'action must be check, grant or force' });
    if (!isPositiveInt(order_id)) return res.status(400).json({ error: 'order_id must be a positive whole number' });
    if (!units.length || !units.every((u) => Number.isInteger(u) && u >= 0) || !units.some((u) => u > 0)) {
      return res.status(400).json({ error: 'Ask for at least one unit, in whole numbers.' });
    }

    await repo.getBankersData(); // bring pools up to date before taking their locks
    const result = await repo.withPoolsLocked(async (conn) => {
      const data = await repo.getBankersData({ conn });
      if (units.length !== data.pools.length) {
        throw Object.assign(new Error('The resource pools just changed. Reload and try again.'), { status: 409 });
      }
      const order = data.orders.find((o) => o.order_id === order_id);
      if (!order) throw Object.assign(new Error('Order not found, or already finished.'), { status: 404 });

      const decision = await engine.bankers(data, { order_id, units });
      const sequenceNames = namesFor(data, decision.sequence);
      if (units.some((u, j) => u > order.need[j])) {
        return { outcome: 'REFUSED', message: `This is more than the order's Maximum allows.` };
      }

      const poolIds = data.pools.map((p) => p.pool_id);
      const notEnoughFree = units.some((u, j) => u > data.pools[j].available_units);
      const waitMessage = notEnoughFree ? 'Not enough units are free right now.' : 'Granting this now would leave the system unsafe.';

      if (action === 'check') {
        if (decision.granted) return { outcome: 'SAFE', message: 'Granting this keeps the system safe.', sequenceNames };
        return { outcome: notEnoughFree ? 'WOULD_WAIT' : 'UNSAFE', message: waitMessage };
      }
      if (notEnoughFree || (action === 'grant' && !decision.granted)) {
        await repo.recordWaitingRequest(conn, order_id, poolIds, units);
        return { outcome: 'WAITING', message: `${waitMessage} The order is now waiting for these units.` };
      }
      await repo.grantClaim(conn, order_id, poolIds, units);
      if (decision.granted) return { outcome: action === 'force' ? 'FORCED' : 'GRANTED', safe: true, message: 'The system is still safe.', sequenceNames };
      return { outcome: 'FORCED', safe: false, message: 'The safety check was skipped, and the system is now unsafe.' };
    });
    res.json(result);
  } catch (e) { next(e); }
});

// POST /api/os/bankers/release  { order_id }   -> deadlock recovery by preemption
router.post('/bankers/release', manager, async (req, res, next) => {
  try {
    const order_id = Number(req.body?.order_id);
    if (!isPositiveInt(order_id)) return res.status(400).json({ error: 'order_id must be a positive whole number' });
    await repo.preemptOrder(order_id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PATCH /api/os/bankers/claims  { order_id, pool_id, max_units }
router.patch('/bankers/claims', manager, async (req, res, next) => {
  try {
    const order_id = Number(req.body?.order_id);
    const pool_id = Number(req.body?.pool_id);
    const max_units = Number(req.body?.max_units);
    if (!isPositiveInt(order_id) || !isPositiveInt(pool_id)) return res.status(400).json({ error: 'order_id and pool_id must be positive whole numbers' });
    if (!Number.isInteger(max_units) || max_units < 0) return res.status(400).json({ error: 'Maximum must be a whole number, 0 or more.' });
    await repo.setClaimMax(order_id, pool_id, max_units);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/os/deadlock  -> detection over what orders are waiting for right now
router.get('/deadlock', async (req, res, next) => {
  try {
    const data = await repo.getBankersData();
    const result = await engine.deadlock(data);
    res.json({ ...data, ...result });
  } catch (e) { next(e); }
});

function namesFor(data, pids) {
  const byId = new Map(data.orders.map((o) => [o.order_id, o.product_name]));
  return (pids || []).map((id) => ({ order_id: id, product_name: byId.get(id) }));
}

module.exports = router;
