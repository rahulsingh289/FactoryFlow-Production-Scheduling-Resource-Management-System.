// Machines: list, add, change status, delete.
const express = require('express');
const repo = require('../db/repo');
const { manager, parseId, clean } = require('./helpers');

const router = express.Router();

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

module.exports = router;
