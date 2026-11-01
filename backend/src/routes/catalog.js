// CRUD-ish endpoints for the factory entities: orders, machines, workers,
// inventory and resource pools.
const express = require('express');
const repo = require('../db/repo');
const { requireAuth } = require('../services/auth');

const router = express.Router();

// A route param like :id should be a positive integer. Anything else (text,
// negative, decimal) is rejected with a clear 400 instead of silently
// becoming NaN and reaching the database or in-memory store.
function parseId(raw) {
  if (!/^\d+$/.test(String(raw))) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

// --------------------------------- Orders ----------------------------------
router.get('/orders', async (req, res, next) => {
  try { res.json(await repo.listOrders()); } catch (e) { next(e); }
});

router.post('/orders', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const required = ['product_name', 'quantity', 'execution_time', 'deadline'];
    for (const f of required) if (b[f] === undefined || b[f] === '') return res.status(400).json({ error: `${f} is required` });

    const quantity = Number(b.quantity);
    const arrival_time = Number(b.arrival_time ?? 0);
    const execution_time = Number(b.execution_time);
    const priority = Number(b.priority ?? 3);
    const deadline = Number(b.deadline);

    if (!Number.isFinite(quantity) || quantity <= 0) return res.status(400).json({ error: 'quantity must be a positive number' });
    if (!Number.isFinite(arrival_time) || arrival_time < 0) return res.status(400).json({ error: 'arrival_time must be 0 or more' });
    if (!Number.isFinite(execution_time) || execution_time <= 0) return res.status(400).json({ error: 'execution_time must be a positive number' });
    if (!Number.isInteger(priority) || priority < 1 || priority > 5) return res.status(400).json({ error: 'priority must be an integer from 1 to 5' });
    if (!Number.isFinite(deadline) || deadline < 0) return res.status(400).json({ error: 'deadline must be 0 or more' });

    const order = await repo.addOrder({
      product_name: String(b.product_name).trim(),
      quantity, arrival_time, execution_time, priority, deadline,
      required_machine_type: b.required_machine_type ? String(b.required_machine_type).trim() : null,
    });
    res.status(201).json(order);
  } catch (e) { next(e); }
});

router.patch('/orders/:id/status', requireAuth, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid order id' });
    const valid = ['READY', 'RUNNING', 'BLOCKED', 'COMPLETED'];
    if (!valid.includes(req.body?.status)) return res.status(400).json({ error: 'invalid status' });
    res.json(await repo.updateOrderStatus(id, req.body.status));
  } catch (e) { next(e); }
});

router.delete('/orders/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid order id' });
    await repo.deleteOrder(id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// -------------------------------- Machines ----------------------------------
router.get('/machines', async (req, res, next) => {
  try { res.json(await repo.listMachines()); } catch (e) { next(e); }
});
router.patch('/machines/:id/status', requireAuth, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid machine id' });
    const valid = ['AVAILABLE', 'BUSY', 'MAINTENANCE'];
    if (!valid.includes(req.body?.status)) return res.status(400).json({ error: 'invalid status' });
    await repo.updateMachineStatus(id, req.body.status);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.post('/machines', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.machine_name || !b.machine_type) return res.status(400).json({ error: 'machine_name and machine_type are required' });
    const capacity = Number(b.capacity ?? 1);
    if (!Number.isFinite(capacity) || capacity <= 0) return res.status(400).json({ error: 'capacity must be a positive number' });
    res.status(201).json(await repo.addMachine({
      machine_name: String(b.machine_name).trim(), machine_type: String(b.machine_type).trim(),
      capacity, status: b.status || 'AVAILABLE',
    }));
  } catch (e) { next(e); }
});

// --------------------------------- Workers ----------------------------------
router.get('/workers', async (req, res, next) => {
  try { res.json(await repo.listWorkers()); } catch (e) { next(e); }
});
router.post('/workers', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.full_name || !b.skill) return res.status(400).json({ error: 'full_name and skill are required' });
    res.status(201).json(await repo.addWorker({ full_name: String(b.full_name).trim(), skill: String(b.skill).trim(), status: b.status || 'AVAILABLE' }));
  } catch (e) { next(e); }
});

// -------------------------------- Inventory ---------------------------------
router.get('/inventory', async (req, res, next) => {
  try { res.json(await repo.listInventory()); } catch (e) { next(e); }
});
router.patch('/inventory/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid material id' });
    const qty = Number(req.body?.quantity_available);
    if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ error: 'quantity_available must be 0 or more' });
    await repo.updateInventoryQty(id, qty);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.post('/inventory', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.material_name) return res.status(400).json({ error: 'material_name is required' });
    const quantity_available = Number(b.quantity_available ?? 0);
    const reorder_level = Number(b.reorder_level ?? 0);
    if (!Number.isFinite(quantity_available) || quantity_available < 0) return res.status(400).json({ error: 'quantity_available must be 0 or more' });
    if (!Number.isFinite(reorder_level) || reorder_level < 0) return res.status(400).json({ error: 'reorder_level must be 0 or more' });
    res.status(201).json(await repo.addInventoryItem({
      material_name: String(b.material_name).trim(), quantity_available, reorder_level,
      unit: b.unit ? String(b.unit).trim() : 'units',
    }));
  } catch (e) { next(e); }
});

// ------------------------------ Resource pools ------------------------------
router.get('/pools', async (req, res, next) => {
  try { res.json(await repo.listPools()); } catch (e) { next(e); }
});
router.post('/pools', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const total_units = Number(b.total_units);
    if (!b.pool_name || !Number.isFinite(total_units) || total_units < 0) {
      return res.status(400).json({ error: 'pool_name and a non-negative total_units are required' });
    }
    const available_units = b.available_units != null ? Number(b.available_units) : total_units;
    if (!Number.isFinite(available_units) || available_units < 0 || available_units > total_units) {
      return res.status(400).json({ error: 'available_units must be between 0 and total_units' });
    }
    res.status(201).json(await repo.addPool({ pool_name: String(b.pool_name).trim(), total_units, available_units }));
  } catch (e) { next(e); }
});

module.exports = router;
