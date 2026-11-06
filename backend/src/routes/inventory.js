// Raw materials and their stock ledger.
const express = require('express');
const repo = require('../db/repo');
const { manager, parseId, clean, limitParam } = require('./helpers');

const router = express.Router();

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

module.exports = router;
