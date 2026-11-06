// Every endpoint that needs a signed-in user, mounted under /api by app.js.
const express = require('express');

const router = express.Router();

router.use(require('./orders'));
router.use(require('./machines'));
router.use(require('./workers'));
router.use(require('./inventory'));
router.use(require('./pools'));
router.use('/os', require('./scheduling'));
router.use('/os', require('./bankers'));
router.use('/reports', require('./reports'));

module.exports = router;
