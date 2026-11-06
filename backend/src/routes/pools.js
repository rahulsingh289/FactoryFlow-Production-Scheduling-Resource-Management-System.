// Resource pools (what the Banker's Algorithm shares out).
const express = require('express');
const repo = require('../db/repo');
const { manager, parseId, clean } = require('./helpers');

const router = express.Router();

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
