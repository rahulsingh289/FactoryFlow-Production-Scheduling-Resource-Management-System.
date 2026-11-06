// =========================================================================
//  Smart Factory Production Scheduler — server
//  Creates the Express app (see app.js) and starts listening on PORT.
// =========================================================================
require('dotenv').config();

const { createApp } = require('./app');
const db = require('./db');
const engine = require('./services/engine');

const PORT = Number(process.env.PORT || 4000);

// A forgotten promise should be logged, not take the whole server down.
process.on('unhandledRejection', (reason) => console.error('[unhandled]', reason));

// A host stops the old server when it deploys a new version (SIGTERM). Finish the
// requests in progress first, then exit, but never wait longer than 10 seconds.
function shutDownGracefully(server, signal) {
  console.log(`[server] ${signal} received, finishing open requests...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
}

createApp()
  .then((app) => {
    const server = app.listen(PORT, () => {
      console.log(`\n  Smart Factory API running on http://localhost:${PORT}`);
      console.log(`  DB mode:      ${db.state.mode}`);
      console.log(`  C++ engine:   ${engine.engineAvailable() ? 'built ✓' : 'NOT built — run: cd engine && make'}`);
      console.log(`  Health check: http://localhost:${PORT}/api/health\n`);
    });
    for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => shutDownGracefully(server, signal));
  })
  .catch((e) => {
    console.error('Fatal startup error:', e);
    process.exit(1);
  });
