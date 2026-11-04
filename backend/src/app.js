// =========================================================================
//  Smart Factory Production Scheduler — Express app
//  Builds the Express app (routes, middleware, error handling) without
//  starting an HTTP listener. Used by:
//    - server.js      (local dev: creates the app, then app.listen())
//    - /api/index.js  (Vercel: wraps the same app as a serverless function)
//  Keeping this split means the exact same routing code runs in both places.
// =========================================================================
const express = require('express');
const cors = require('cors');

const db = require('./db');
const engine = require('./services/engine');
const { requireAuth } = require('./middleware/auth');

// Bad input the database itself rejects, in words the client can act on.
const DB_INPUT_ERRORS = {
  ER_DUP_ENTRY: [409, 'That name is already in use.'],
  ER_DATA_TOO_LONG: [400, 'That text is too long.'],
  ER_WARN_DATA_OUT_OF_RANGE: [400, 'That number is too large.'],
  ER_NO_REFERENCED_ROW_2: [400, 'One of the items you chose does not exist.'],
};

async function createApp() {
  await db.init(); // connect MySQL (empty in-memory fallback)

  const app = express();
  app.disable('x-powered-by');
  // Behind Vercel's proxy every request would otherwise look like it comes from
  // one address, and the sign-in rate limit would be shared by all users.
  if (process.env.VERCEL || process.env.TRUST_PROXY) app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json());
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
    next();
  });

  // Health / status (shows which DB mode and whether the C++ engine is built)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      dbMode: db.state.mode,                 // 'mysql' | 'memory'
      engineBuilt: engine.engineAvailable(),
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', require('./routes/auth'));

  // Everything past this point needs a signed-in user.
  app.use('/api', requireAuth);
  app.use('/api', require('./routes/catalog'));
  app.use('/api/os', require('./routes/os'));
  app.use('/api/reports', require('./routes/reports'));

  // Anything under /api that no route handled.
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // Central error handler. Full detail always goes to the server console;
  // the client only ever sees a generic message, so internal detail (SQL
  // error text, file paths, stack traces) never leaks over the network.
  // Errors deliberately raised with a status are safe to show as written.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body is not valid JSON.' });
    if (err.status) return res.status(err.status).json({ error: err.message });
    const known = DB_INPUT_ERRORS[err.code];
    if (known) return res.status(known[0]).json({ error: known[1] });
    console.error(`[api error] ${req.method} ${req.originalUrl} —`, err.stack || err.message);
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
  });

  return app;
}

module.exports = { createApp };
