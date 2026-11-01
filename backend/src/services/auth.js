// ---------------------------------------------------------------------------
// JWT helpers and the auth middleware used to protect write endpoints.
// ---------------------------------------------------------------------------
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Never fall back to a fixed, predictable secret — anyone reading the source
// (this is a public repo) could forge tokens for any user. If JWT_SECRET
// isn't set, generate a random one at startup instead; existing sessions
// just get signed out on restart, which is an acceptable trade-off here.
const PLACEHOLDER = 'change-this-secret-for-production';
const fromEnv = process.env.JWT_SECRET;
const SECRET = (fromEnv && fromEnv !== PLACEHOLDER) ? fromEnv : crypto.randomBytes(48).toString('hex');
if (!fromEnv || fromEnv === PLACEHOLDER) {
  console.warn('[auth] JWT_SECRET not set in backend/.env — using a random secret for this run (sessions will not survive a restart).');
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

module.exports = { signToken, requireAuth };
