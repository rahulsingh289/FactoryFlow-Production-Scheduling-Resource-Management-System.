// Workers: list, add, change trained machine type or shift status, delete.
const express = require('express');
const repo = require('../db/repo');
const { manager, parseId, clean } = require('./helpers');

const router = express.Router();

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

module.exports = router;
