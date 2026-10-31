// ---------------------------------------------------------------------------
// JWT helpers and the auth middleware used to protect write endpoints.
// ---------------------------------------------------------------------------
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret';

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
