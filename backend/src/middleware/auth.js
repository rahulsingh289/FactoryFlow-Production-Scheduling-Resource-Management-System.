// ---------------------------------------------------------------------------
// JWT helpers and the auth middleware that protects the API.
// ---------------------------------------------------------------------------
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Never fall back to a fixed, predictable secret — anyone reading the source
// (this is a public repo) could forge tokens for any user. If JWT_SECRET
// isn't set, generate a random one at startup instead; existing sessions
// just get signed out on restart, which is an acceptable trade-off here.
const PLACEHOLDER = 'change-this-secret-for-production';
const fromEnv = process.env.JWT_SECRET;
const hasSecret = Boolean(fromEnv) && fromEnv !== PLACEHOLDER;
const SECRET = hasSecret ? fromEnv : crypto.randomBytes(48).toString('hex');
if (!hasSecret) {
  console.warn('[auth] JWT_SECRET not set in backend/.env — using a random secret for this run (sessions will not survive a restart).');
}

if (!process.env.MANAGER_CODE) {
  console.warn('[auth] MANAGER_CODE is not set, so every new account is a manager. Set it to make new accounts view-only.');
}

function signToken(user) {
  return jwt.sign(
    { sub: user.user_id, username: user.username, role: user.role, name: user.full_name },
    SECRET,
    { expiresIn: '8h' }
  );
}

// Verify the Bearer token. Attaches req.user on success.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Only the listed roles may continue. A view-only account (OPERATOR) can look at
// everything and run orders, but can't change how the factory is set up.
function requireRole(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user?.role)) return next();
    res.status(403).json({ error: 'Your account is view-only. Ask a manager to do this.' });
  };
}

module.exports = { signToken, requireAuth, requireRole };
