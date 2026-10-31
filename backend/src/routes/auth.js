const express = require('express');
const bcrypt = require('bcryptjs');
const repo = require('../db/repo');
const { signToken, requireAuth } = require('../services/auth');

const router = express.Router();

// POST /api/auth/login  { username, password }
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const user = await repo.findUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({
    token: signToken(user),
    user: { username: user.username, name: user.full_name, role: user.role },
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, name: req.user.name, role: req.user.role });
});

module.exports = router;
