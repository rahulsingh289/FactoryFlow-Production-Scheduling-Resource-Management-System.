// =========================================================================
//  Smart Factory Production Scheduler — REST API server
//  Node.js + Express. Talks to MySQL (or an in-memory fallback store) and
//  runs the C++ OS engine for scheduling / Banker's / deadlock computations.
// =========================================================================
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const db = require('./db');
const engine = require('./services/engine');

const PORT = Number(process.env.PORT || 4000);

async function main() {
  await db.init();                 // connect MySQL (empty in-memory fallback)

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

  app.listen(PORT, () => {
    console.log(`\n  Smart Factory API running on http://localhost:${PORT}`);
    console.log(`  DB mode:      ${db.state.mode}`);
    console.log(`  C++ engine:   ${engine.engineAvailable() ? 'built ✓' : 'NOT built — run: cd engine && g++ -std=c++17 -Iinclude src/*.cpp -o factory_engine'}`);
    console.log(`  Health check: http://localhost:${PORT}/api/health\n`);
  });
}

main().catch((e) => {
  console.error('Fatal startup error:', e);
  process.exit(1);
});
