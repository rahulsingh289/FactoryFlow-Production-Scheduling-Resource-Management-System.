const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const repo = require('../db/repo');
const { signToken, requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// Compared against when the username doesn't exist, so a wrong username takes as
// long to answer as a wrong password and can't be told apart by timing.
const NO_SUCH_USER_HASH = bcrypt.hashSync('no-such-user', 10);

// Limit repeated attempts so credentials can't be brute-forced.
const authLimiter = rateLimit({ windowMs: 60_000, max: 10 });

// With MANAGER_CODE set, an account is view-only (OPERATOR) unless it signs up
// with that code. Without it, every account is a manager, as on a local machine.
const managerCode = () => String(process.env.MANAGER_CODE || '').trim();
function codeMatches(given) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(managerCode());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// GET /api/auth/options  -> whether the sign-up form should ask for a manager code
router.get('/options', (req, res) => res.json({ managerCode: Boolean(managerCode()) }));

// POST /api/auth/login  { username, password }
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    const user = await repo.findUserByUsername(String(username).trim().toLowerCase());
    const matches = await bcrypt.compare(String(password), user ? user.password_hash : NO_SUCH_USER_HASH);
    if (!user || !matches) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    res.json({
      token: signToken(user),
      user: { username: user.username, name: user.full_name, role: user.role },
    });
  } catch (e) { next(e); }
});

// POST /api/auth/register  { full_name, username, email, password, manager_code? }
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

    let role = 'MANAGER';
    if (managerCode()) {
      const given = String(b.manager_code || '').trim();
      if (!given) role = 'OPERATOR';
      else if (!codeMatches(given)) return res.status(400).json({ error: 'That manager code is not right.' });
    }

    if (await repo.findUserByUsername(username)) return res.status(409).json({ error: 'That username is already taken.' });
    if (await repo.findUserByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists.' });

    let user;
    try {
      user = await repo.createUser({ username, email, full_name, password, role });
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
