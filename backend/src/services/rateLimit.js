// ---------------------------------------------------------------------------
// A small in-memory rate limiter for auth endpoints (login / register), to
// slow down brute-force and account-enumeration attempts. No external
// dependency — just a sliding window keyed by IP.
// ---------------------------------------------------------------------------
const hits = new Map(); // ip -> [timestamps]

function rateLimit({ windowMs = 60_000, max = 10 } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const timestamps = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= max) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a moment and try again.' });
    }
    timestamps.push(now);
    hits.set(ip, timestamps);
    next();
  };
}

// Periodically forget IPs with no recent activity so the map doesn't grow forever.
setInterval(() => {
  const cutoff = Date.now() - 5 * 60_000;
  for (const [ip, timestamps] of hits) {
    if (timestamps.every((t) => t < cutoff)) hits.delete(ip);
  }
}, 5 * 60_000).unref();

module.exports = { rateLimit };
