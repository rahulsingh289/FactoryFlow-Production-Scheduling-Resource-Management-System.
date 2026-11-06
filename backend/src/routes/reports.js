// Dashboard statistics, analytics and schedule-run history.
const express = require('express');
const repo = require('../db/repo');
const { limitParam } = require('./helpers');

const router = express.Router();

router.get('/dashboard', async (req, res, next) => {
  try { res.json(await repo.dashboardStats()); } catch (e) { next(e); }
});

router.get('/analytics', async (req, res, next) => {
  try { res.json(await repo.getAnalytics()); } catch (e) { next(e); }
});

router.get('/schedule-runs', async (req, res, next) => {
  try { res.json(await repo.listScheduleRuns(limitParam(req.query.limit, 10))); } catch (e) { next(e); }
});

module.exports = router;
