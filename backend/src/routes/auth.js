const express = require('express');
const bcrypt = require('bcryptjs');
const repo = require('../db/repo');
const { signToken, requireAuth } = require('../services/auth');
const { rateLimit } = require('../services/rateLimit');

const router = express.Router();

// Limit repeated attempts so credentials can't be brute-forced.
const authLimiter = rateLimit({ windowMs: 60_000, max: 10 });

// POST /api/auth/login  { username, password }
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    const user = await repo.findUserByUsername(String(username).trim().toLowerCase());
    if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    res.json({
      token: signToken(user),
      user: { username: user.username, name: user.full_name, role: user.role },
    });
  } catch (e) { next(e); }
});

// POST /api/auth/register  { full_name, username, email, password }
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const b = req.body || {};
    const full_name = String(b.full_name || '').trim();
    const username = String(b.username || '').trim().toLowerCase();
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');

    if (!full_name || !username || !email || !password) {
      return res.status(400).json({ error: 'Full name, username, email and password are all required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) return res.status(400).json({ error: 'Username must be 3-30 characters: letters, numbers, dot, dash or underscore.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    if (await repo.findUserByUsername(username)) return res.status(409).json({ error: 'That username is already taken.' });
    if (await repo.findUserByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists.' });

    let user;
    try {
      user = await repo.createUser({ username, email, full_name, password, role: 'MANAGER' });
    } catch (e) {
      // Two signups for the same username/email at the same instant can both
      // pass the checks above; the database's UNIQUE constraint is the real
      // guard. Turn that race into a clean 409 instead of a raw DB error.
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That username or email is already in use.' });
      throw e;
    }
    res.status(201).json({
      token: signToken(user),
      user: { username: user.username, name: user.full_name, role: user.role },
    });
  } catch (e) { next(e); }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, name: req.user.name, role: req.user.role });
});

module.exports = router;
