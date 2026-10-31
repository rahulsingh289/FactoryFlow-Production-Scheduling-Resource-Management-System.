// ---------------------------------------------------------------------------
// Database bootstrap and mode selection.
//
//   mode === 'mysql'   -> real MySQL via a mysql2 connection pool
//   mode === 'memory'  -> seeded in-memory store (used when MySQL is absent)
//
// On first connect, if the `smart_factory` database / tables are missing, the
// backend auto-runs schema.sql, seed.sql and views.sql so there is zero manual
// setup to just see the app. (procedures.sql uses the CLI-only DELIMITER
// keyword, so it is left for you to run manually — the app does not need it.)
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_DIR = path.join(__dirname, '..', '..', '..', 'database');

const state = {
  mode: 'memory',   // resolved during init()
  pool: null,
};

async function runSqlFile(conn, file) {
  const sql = fs.readFileSync(path.join(DB_DIR, file), 'utf8');
  await conn.query(sql); // multipleStatements must be enabled
}

async function bootstrapIfNeeded(baseConfig) {
  // Connect WITHOUT selecting a database so we can create it if missing
  // (connecting with a not-yet-existing database would fail).
  const { database, ...serverOnly } = baseConfig;
  const conn = await mysql.createConnection({ ...serverOnly, multipleStatements: true });
  try {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS n FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'production_orders'`,
      [baseConfig.database]
    );
    if (rows[0].n === 0) {
      console.log('[db] smart_factory not found — bootstrapping schema, seed and views...');
      await runSqlFile(conn, 'schema.sql');
      await runSqlFile(conn, 'seed.sql');
      await runSqlFile(conn, 'views.sql');
      console.log('[db] bootstrap complete.');
    }
  } finally {
    await conn.end();
  }
}

async function init() {
  if ((process.env.DB_MODE || '').toLowerCase() === 'memory') {
    console.log('[db] DB_MODE=memory — using in-memory demo data.');
    state.mode = 'memory';
    return state;
  }

  const baseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_factory',
  };

  try {
    await bootstrapIfNeeded(baseConfig);
    state.pool = mysql.createPool({
      ...baseConfig,
      multipleStatements: true,
      waitForConnections: true,
      connectionLimit: 10,
    });
    await state.pool.query('SELECT 1');
    state.mode = 'mysql';
    console.log(`[db] connected to MySQL at ${baseConfig.host}:${baseConfig.port}/${baseConfig.database}`);
  } catch (err) {
    console.warn('[db] MySQL not available (' + err.code + ') — falling back to in-memory DEMO mode.');
    console.warn('[db] To use MySQL: start the server and set credentials in backend/.env');
    state.mode = 'memory';
    state.pool = null;
  }
  return state;
}

module.exports = { state, init };
