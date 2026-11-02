// =========================================================================
//  Smart Factory Production Scheduler — local dev server
//  Creates the Express app (see app.js) and starts listening on PORT.
//  For Vercel, api/index.js wraps the same app as a serverless function
//  instead of calling listen() — this file is only used for `npm start`.
// =========================================================================
require('dotenv').config();

const { createApp } = require('./app');
const db = require('./db');
const engine = require('./services/engine');

const PORT = Number(process.env.PORT || 4000);

createApp()
  .then((app) => {
    app.listen(PORT, () => {
      console.log(`\n  Smart Factory API running on http://localhost:${PORT}`);
      console.log(`  DB mode:      ${db.state.mode}`);
      console.log(`  C++ engine:   ${engine.engineAvailable() ? 'built ✓' : 'NOT built — run: cd engine && g++ -std=c++17 -Iinclude src/*.cpp -o factory_engine'}`);
      console.log(`  Health check: http://localhost:${PORT}/api/health\n`);
    });
  })
  .catch((e) => {
    console.error('Fatal startup error:', e);
    process.exit(1);
  });
