// Production orders: list, create, edit, change state, delete.
const express = require('express');
const repo = require('../db/repo');
const { manager, parseId, clean } = require('./helpers');

const router = express.Router();

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
// The highest values are generous but finite: the scheduler steps through time, so a
// burst of billions of units would run for ever, and sums that large overflow it.
const WHOLE_NUMBERS = [
  // field, lowest, highest, message, default for a new order
  ['quantity', 1, 1_000_000, 'quantity must be a whole number from 1 to 1,000,000'],
  ['arrival_time', 0, 1_000_000, 'arrival_time must be a whole number from 0 to 1,000,000', 0],
  ['execution_time', 1, 100_000, 'execution_time must be a whole number from 1 to 100,000'],
  ['priority', 1, 5, 'priority must be an integer from 1 to 5', 3],
  ['deadline', 0, 1_000_000, 'deadline must be a whole number from 0 to 1,000,000'],
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

module.exports = router;
