// Small helpers shared by the route files.
const { requireRole } = require('../middleware/auth');

// View-only accounts can look at everything and start or finish orders, but only
// managers can add, change or delete orders, machines, workers, stock and pools.
const manager = requireRole('MANAGER');

// A route param like :id should be a positive integer. Anything else (text,
// negative, decimal) is rejected with a clear 400 instead of silently
// becoming NaN and reaching the database or in-memory store.
function parseId(raw) {
  if (!/^\d+$/.test(String(raw))) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

// ?limit=… as a sane row count: whole, at least 1, at most 200.
const limitParam = (raw, fallback) => Math.min(Math.max(Math.floor(Number(raw)) || fallback, 1), 200);

// Trimmed text, so a name made only of spaces counts as missing.
const clean = (v) => String(v ?? '').trim();

module.exports = { manager, parseId, isPositiveInt, limitParam, clean };
