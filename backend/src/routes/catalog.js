// CRUD-ish endpoints for the factory entities: orders, machines,
// workers, inventory and resource pools.
const express = require('express');
const repo = require('../db/repo');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// View-only accounts can look at everything and start or finish orders, but only
// managers can add, change or delete orders, machines, workers, stock and pools.
const manager = requireRole('MANAGER');

// A route param like :id should be a positive integer. Anything else (text,
// negative, decimal) is rejected with a clear 400 instead of silently
// becoming NaN and reaching the database or in-memory store.
function parseId(raw) {
  if (!/^\d+$/.test(String(raw))) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

// ?limit=… as a sane row count: whole, at least 1, at most 200.
const limitParam = (raw, fallback) => Math.min(Math.max(Math.floor(Number(raw)) || fallback, 1), 200);

// Trimmed text, so a name made only of spaces counts as missing.
const clean = (v) => String(v ?? '').trim();

// --------------------------------- Orders ----------------------------------
// Finished orders pile up, so by default only the newest few come back along with
// every unfinished order. ?finished=all returns the whole history.
const RECENT_FINISHED = 25;
router.get('/orders', async (req, res, next) => {
  try {
    res.json(await repo.listOrders(req.query.finished === 'all' ? {} : { recentFinished: RECENT_FINISHED }));
  } catch (e) { next(e); }
});
// How many orders are in each state (the full counts, not just the ones listed).
router.get('/orders/counts', async (req, res, next) => {
  try { res.json(await repo.countOrdersByStatus()); } catch (e) { next(e); }
});

// Checks the fields of an order. A new order needs the main fields; an edit
// (partial) only checks the ones it sends. Returns { fields } or { error }.
const WHOLE_NUMBERS = [
  // field, lowest, highest, message, default for a new order
  ['quantity', 1, Infinity, 'quantity must be a positive whole number'],
  ['arrival_time', 0, Infinity, 'arrival_time must be a whole number, 0 or more', 0],
  ['execution_time', 1, Infinity, 'execution_time must be a positive whole number'],
  ['priority', 1, 5, 'priority must be an integer from 1 to 5', 3],
  ['deadline', 0, Infinity, 'deadline must be a whole number, 0 or more'],
];

function parseOrder(b, { partial }) {
  const fields = {};
  const sent = (key) => b[key] !== undefined;
  if (!partial) {
    for (const key of ['product_name', 'quantity', 'execution_time', 'deadline']) {
      if (!clean(b[key])) return { error: `${key} is required` };
    }
  }
  if (sent('product_name') || !partial) {
    if (!clean(b.product_name)) return { error: 'product_name is required' };
    fields.product_name = clean(b.product_name);
  }
  for (const [key, low, high, message, fallback] of WHOLE_NUMBERS) {
    if (!sent(key) && partial) continue;
    const value = Number(sent(key) ? b[key] : fallback);
    if (!Number.isInteger(value) || value < low || value > high) return { error: message };
    fields[key] = value;
  }
  if (sent('required_machine_type') || !partial) fields.required_machine_type = clean(b.required_machine_type) || null;
  return { fields };
}

// materials: [{ material_id, quantity }] -> a clean list, or an error. Left out = unchanged.
function parseMaterials(raw) {
  if (raw === undefined) return { materials: undefined };
  if (!Array.isArray(raw)) return { error: 'materials must be a list' };
  const seen = new Set();
  const materials = [];
  for (const m of raw) {
    const material_id = Number(m?.material_id);
    const quantity = Number(m?.quantity);
    if (!Number.isInteger(material_id) || material_id <= 0) return { error: 'Choose a material for each row.' };
    if (!Number.isInteger(quantity) || quantity <= 0) return { error: 'Each material needs a whole quantity above 0.' };
    if (seen.has(material_id)) return { error: 'Each material can only be listed once.' };
    seen.add(material_id);
    materials.push({ material_id, quantity });
  }
  return { materials };
}

router.post('/orders', manager, async (req, res, next) => {
  try {
    const b = req.body || {};
    const order = parseOrder(b, { partial: false });
    if (order.error) return res.status(400).json({ error: order.error });
    const list = parseMaterials(b.materials);
    if (list.error) return res.status(400).json({ error: list.error });
    res.status(201).json(await repo.addOrder({ ...order.fields, materials: list.materials || [] }));
  } catch (e) { next(e); }
});

// Edit an order's details and, until it has started, its materials.
router.patch('/orders/:id', manager, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid order id' });
    const b = req.body || {};
    const order = parseOrder(b, { partial: true });
    if (order.error) return res.status(400).json({ error: order.error });
    const list = parseMaterials(b.materials);
    if (list.error) return res.status(400).json({ error: list.error });
    if (!Object.keys(order.fields).length && list.materials === undefined) return res.status(400).json({ error: 'Nothing to change.' });
    res.json(await repo.updateOrder(id, order.fields, list.materials));
  } catch (e) { next(e); }
});

router.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid order id' });
    const valid = ['READY', 'RUNNING', 'BLOCKED', 'COMPLETED'];
    if (!valid.includes(req.body?.status)) return res.status(400).json({ error: 'invalid status' });
    res.json(await repo.updateOrderStatus(id, req.body.status));
  } catch (e) { next(e); }
});

router.delete('/orders/:id', manager, async (req, res, next) => {
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
router.patch('/machines/:id/status', manager, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid machine id' });
    // BUSY isn't settable: it's derived from running orders.
    const valid = ['AVAILABLE', 'MAINTENANCE'];
    if (!valid.includes(req.body?.status)) return res.status(400).json({ error: 'invalid status' });
    await repo.updateMachineStatus(id, req.body.status);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.post('/machines', manager, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!clean(b.machine_name) || !clean(b.machine_type)) return res.status(400).json({ error: 'machine_name and machine_type are required' });
    const capacity = Number(b.capacity ?? 1);
    if (!Number.isInteger(capacity) || capacity <= 0) return res.status(400).json({ error: 'capacity must be a positive whole number' });
    res.status(201).json(await repo.addMachine({
      machine_name: clean(b.machine_name), machine_type: clean(b.machine_type), capacity,
    }));
  } catch (e) { next(e); }
});

router.delete('/machines/:id', manager, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid machine id' });
    await repo.deleteMachine(id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// --------------------------------- Workers ----------------------------------
router.get('/workers', async (req, res, next) => {
  try { res.json(await repo.listWorkers()); } catch (e) { next(e); }
});
router.post('/workers', manager, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!clean(b.full_name) || !clean(b.skill)) return res.status(400).json({ error: 'full_name and skill are required' });
    res.status(201).json(await repo.addWorker({
      full_name: clean(b.full_name), skill: clean(b.skill), machine_type: clean(b.machine_type) || null,
    }));
  } catch (e) { next(e); }
});
// Which machine type a worker is trained on (empty = any machine).
router.patch('/workers/:id', manager, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid worker id' });
    if (req.body?.machine_type === undefined) return res.status(400).json({ error: 'machine_type is required (use an empty value for any machine)' });
    await repo.updateWorkerMachineType(id, clean(req.body.machine_type) || null);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.patch('/workers/:id/status', manager, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid worker id' });
    // ASSIGNED isn't settable: it's derived from running orders.
    const valid = ['AVAILABLE', 'OFF_SHIFT'];
    if (!valid.includes(req.body?.status)) return res.status(400).json({ error: 'invalid status' });
    await repo.updateWorkerStatus(id, req.body.status);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/workers/:id', manager, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid worker id' });
    await repo.deleteWorker(id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// -------------------------------- Inventory ---------------------------------
router.get('/inventory', async (req, res, next) => {
  try { res.json(await repo.listInventory()); } catch (e) { next(e); }
});
router.get('/inventory/ledger', async (req, res, next) => {
  try { res.json(await repo.listInventoryLedger(limitParam(req.query.limit, 15))); } catch (e) { next(e); }
});
router.patch('/inventory/:id', manager, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid material id' });
    const qty = Number(req.body?.quantity_available);
    if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'Quantity must be a whole number, 0 or more.' });
    await repo.updateInventoryQty(id, qty);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.delete('/inventory/:id', manager, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid material id' });
    await repo.deleteInventoryItem(id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.post('/inventory', manager, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!clean(b.material_name)) return res.status(400).json({ error: 'material_name is required' });
    const quantity_available = Number(b.quantity_available ?? 0);
    const reorder_level = Number(b.reorder_level ?? 0);
    if (!Number.isInteger(quantity_available) || quantity_available < 0) return res.status(400).json({ error: 'Quantity must be a whole number, 0 or more.' });
    if (!Number.isInteger(reorder_level) || reorder_level < 0) return res.status(400).json({ error: 'Reorder level must be a whole number, 0 or more.' });
    res.status(201).json(await repo.addInventoryItem({
      material_name: clean(b.material_name), quantity_available, reorder_level,
      unit: clean(b.unit) || 'units',
    }));
  } catch (e) { next(e); }
});

// ------------------------------ Resource pools ------------------------------
router.get('/pools', async (req, res, next) => {
  try { res.json(await repo.listPools()); } catch (e) { next(e); }
});
router.post('/pools', manager, async (req, res, next) => {
  try {
    const b = req.body || {};
    const total_units = Number(b.total_units);
    if (!clean(b.pool_name) || !Number.isInteger(total_units) || total_units < 0) {
      return res.status(400).json({ error: 'A pool needs a name and a whole number of units.' });
    }
    res.status(201).json(await repo.addPool({ pool_name: clean(b.pool_name), total_units }));
  } catch (e) { next(e); }
});

router.delete('/pools/:id', manager, async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid pool id' });
    await repo.deletePool(id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
