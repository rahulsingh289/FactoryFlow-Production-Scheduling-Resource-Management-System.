// CRUD-ish endpoints for the factory entities: orders, machines, workers,
// inventory and resource pools.
const express = require('express');
const repo = require('../db/repo');
const { requireAuth } = require('../services/auth');

const router = express.Router();

// --------------------------------- Orders ----------------------------------
router.get('/orders', async (req, res, next) => {
  try { res.json(await repo.listOrders()); } catch (e) { next(e); }
});

router.post('/orders', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const required = ['product_name', 'quantity', 'execution_time', 'deadline'];
    for (const f of required) if (b[f] === undefined || b[f] === '') return res.status(400).json({ error: `${f} is required` });
    const order = await repo.addOrder({
      product_name: String(b.product_name),
      quantity: Number(b.quantity),
      arrival_time: Number(b.arrival_time || 0),
      execution_time: Number(b.execution_time),
      priority: Number(b.priority || 3),
      deadline: Number(b.deadline),
      required_machine_type: b.required_machine_type || null,
    });
    res.status(201).json(order);
  } catch (e) { next(e); }
});

router.patch('/orders/:id/status', requireAuth, async (req, res, next) => {
  try {
    const valid = ['READY', 'RUNNING', 'BLOCKED', 'COMPLETED'];
    if (!valid.includes(req.body?.status)) return res.status(400).json({ error: 'invalid status' });
    res.json(await repo.updateOrderStatus(Number(req.params.id), req.body.status));
  } catch (e) { next(e); }
});

router.delete('/orders/:id', requireAuth, async (req, res, next) => {
  try { await repo.deleteOrder(Number(req.params.id)); res.json({ ok: true }); } catch (e) { next(e); }
});

// -------------------------------- Machines ----------------------------------
router.get('/machines', async (req, res, next) => {
  try { res.json(await repo.listMachines()); } catch (e) { next(e); }
});
router.patch('/machines/:id/status', requireAuth, async (req, res, next) => {
  try {
    const valid = ['AVAILABLE', 'BUSY', 'MAINTENANCE'];
    if (!valid.includes(req.body?.status)) return res.status(400).json({ error: 'invalid status' });
    await repo.updateMachineStatus(Number(req.params.id), req.body.status);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// --------------------------------- Workers ----------------------------------
router.get('/workers', async (req, res, next) => {
  try { res.json(await repo.listWorkers()); } catch (e) { next(e); }
});

// -------------------------------- Inventory ---------------------------------
router.get('/inventory', async (req, res, next) => {
  try { res.json(await repo.listInventory()); } catch (e) { next(e); }
});
router.patch('/inventory/:id', requireAuth, async (req, res, next) => {
  try {
    const qty = Number(req.body?.quantity_available);
    if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ error: 'quantity_available must be >= 0' });
    await repo.updateInventoryQty(Number(req.params.id), qty);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ------------------------------ Resource pools ------------------------------
router.get('/pools', async (req, res, next) => {
  try { res.json(await repo.listPools()); } catch (e) { next(e); }
});

module.exports = router;
