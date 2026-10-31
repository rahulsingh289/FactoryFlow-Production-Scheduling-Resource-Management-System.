// =========================================================================
//  Smart Factory Production Scheduler — REST API server
//  Node.js + Express. Talks to MySQL (or in-memory demo data) and runs the
//  C++ OS engine for scheduling / Banker's / deadlock computations.
// =========================================================================
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const db = require('./db');
const repo = require('./db/repo');
const engine = require('./services/engine');

const PORT = Number(process.env.PORT || 4000);

async function main() {
  await db.init();                 // connect MySQL or fall back to memory
  await repo.ensureDefaultUsers(); // seed manager/operator logins

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

  // Central error handler
  app.use((err, req, res, next) => {
    console.error('[api error]', err.message);
    res.status(500).json({ error: err.message });
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
