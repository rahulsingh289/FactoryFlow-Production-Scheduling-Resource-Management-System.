// Dashboard statistics, schedule-run history and the audit log.
const express = require('express');
const repo = require('../db/repo');

const router = express.Router();

router.get('/dashboard', async (req, res, next) => {
  try { res.json(await repo.dashboardStats()); } catch (e) { next(e); }
});

router.get('/schedule-runs', async (req, res, next) => {
  try { res.json(await repo.listScheduleRuns(Number(req.query.limit) || 10)); } catch (e) { next(e); }
});

router.get('/audit', async (req, res, next) => {
  try { res.json(await repo.listAudit(Number(req.query.limit) || 20)); } catch (e) { next(e); }
});

module.exports = router;
