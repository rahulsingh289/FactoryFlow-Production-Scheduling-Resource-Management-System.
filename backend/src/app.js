// =========================================================================
//  Smart Factory Production Scheduler — Express app
//  Builds the Express app (routes, middleware, error handling) without
//  starting an HTTP listener. server.js starts it with app.listen(), the tests
//  start it on a free port.
//  When the website has been built (frontend/dist), the app serves it too, so one
//  server runs the whole project (`npm run build`, then `npm start`).
// =========================================================================
const fs = require('fs');
const path = require('path');
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
  // Behind a reverse proxy every request would otherwise look like it comes from one
  // address, and the sign-in rate limit would be shared by all users. Set
  // TRUST_PROXY=1 when running behind one.
  if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json());
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
    next();
  });
  // Answers from the API are live data (and may be private): never let a browser or a
  // proxy keep a copy.
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

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
  app.use('/api', requireAuth, require('./routes'));

  // Anything under /api that no route handled.
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // The built website, when there is one (after `npm run build`).
  // Files in /assets have hashed names, so browsers may keep them; index.html must
  // always be fetched fresh so a new deploy is picked up.
  const site = path.join(__dirname, '..', '..', 'frontend', 'dist');
  if (fs.existsSync(path.join(site, 'index.html'))) {
    app.use(express.static(site, {
      index: false,
      setHeaders: (res, file) => res.set('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache'),
    }));
    app.get('*', (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(site, 'index.html')));
  }

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
