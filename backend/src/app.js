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

async function createApp() {
  await db.init(); // connect MySQL (empty in-memory fallback)

  const app = express();
  app.use(cors());
  app.use(express.json());

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
  app.use('/api', require('./routes/catalog'));
  app.use('/api/os', require('./routes/os'));
  app.use('/api/reports', require('./routes/reports'));

  // Central error handler. Full detail always goes to the server console;
  // the client only ever sees a generic message, so internal detail (SQL
  // error text, file paths, stack traces) never leaks over the network.
  app.use((err, req, res, next) => {
    console.error(`[api error] ${req.method} ${req.originalUrl} —`, err.stack || err.message);
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
  });

  return app;
}

module.exports = { createApp };
