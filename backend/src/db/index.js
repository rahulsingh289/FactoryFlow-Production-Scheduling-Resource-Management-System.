// ---------------------------------------------------------------------------
// Database bootstrap and mode selection.
//
//   mode === 'mysql'   -> real MySQL via a mysql2 connection pool
//   mode === 'memory'  -> empty in-memory store (used when MySQL is absent)
//
// On connect the backend brings the database up to date by itself:
//   - no tables yet        -> creates the schema and loads the seed data
//   - older database       -> adds any columns and tables it is missing
//   - objects out of date  -> reloads views, procedures and triggers
// It never drops anything, so restarting can't lose data.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_DIR = path.join(__dirname, '..', '..', '..', 'database');

// If this trigger is missing, views, procedures and triggers are all reloaded.
// When adding new ones, point this at one of them so older databases pick them up.
const NEWEST_TRIGGER = 'trg_allocation_after_insert';

const state = {
  mode: 'memory',   // resolved during init()
  pool: null,
  database: null,
};

// Split a .sql file into statements, honouring DELIMITER the way the mysql
// command-line client does, so files with stored routines can run from here.
function splitStatements(sql) {
  const statements = [];
  let delimiter = ';';
  let current = '';
  for (const line of sql.split('\n')) {
    const change = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (change) { delimiter = change[1]; continue; }
    if (/^\s*--/.test(line)) continue;
    current += line + '\n';
    const trimmed = current.trimEnd();
    if (trimmed.endsWith(delimiter)) {
      statements.push(trimmed.slice(0, -delimiter.length).trim());
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements.filter(Boolean);
}

// These need admin rights a hosted database may not grant; the app works without them.
const OPTIONAL = /^(CREATE DATABASE|SET GLOBAL|DROP EVENT|CREATE EVENT)/i;

async function runSqlFile(conn, file, database) {
  const sql = fs.readFileSync(path.join(DB_DIR, file), 'utf8').replace(/smart_factory/g, database);
  for (const statement of splitStatements(sql)) {
    try {
      await conn.query(statement);
    } catch (err) {
      if (!OPTIONAL.test(statement)) throw err;
      console.warn(`[db] skipped optional statement in ${file}: ${err.message}`);
    }
  }
}

async function addColumnIfMissing(conn, database, table, column, definition) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
    [database, table, column]
  );
  if (rows[0].n > 0) return false;
  console.log(`[db] adding ${table}.${column}`);
  await conn.query(`ALTER TABLE \`${database}\`.\`${table}\` ADD COLUMN ${column} ${definition}`);
  return true;
}

// Adds an index if the table doesn't have one by that name, so databases made
// before it existed get it too. Same indexes as in database/01_schema.sql.
async function addIndexIfMissing(conn, database, table, name, columns) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?',
    [database, table, name]
  );
  if (rows[0].n > 0) return;
  console.log(`[db] adding index ${table}.${name}`);
  await conn.query(`ALTER TABLE \`${database}\`.\`${table}\` ADD INDEX \`${name}\` (${columns})`);
}

async function prepareDatabase(baseConfig) {
  // Connect WITHOUT selecting a database so we can create it if missing
  // (connecting with a not-yet-existing database would fail).
  const { database, ...serverOnly } = baseConfig;
  if (!/^\w+$/.test(database)) throw new Error('DB_NAME may only contain letters, numbers and underscores.');

  const conn = await mysql.createConnection(serverOnly);
  // Several servers can start at the same moment against one empty database, and each
  // would try to build the same tables. A named
  // lock makes them take turns: the first builds, the rest find it done and move on.
  // A server that doesn't offer locks is simply set up without one.
  const lockName = `factoryflow_setup_${database}`;
  let locked = false;
  try {
    const [[got]] = await conn.query('SELECT GET_LOCK(?, 60) AS got', [lockName]);
    locked = got.got === 1;
  } catch { /* no lock support: carry on */ }
  try {
    const [tables] = await conn.query(
      `SELECT COUNT(*) AS n FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'production_orders'`,
      [database]
    );
    if (tables[0].n === 0) {
      console.log(`[db] ${database} has no tables yet — creating schema and seed data...`);
      await runSqlFile(conn, '01_schema.sql', database);
      await runSqlFile(conn, '02_seed.sql', database);
    }

    await addColumnIfMissing(conn, database, 'order_resource_claims', 'requested_units', 'INT NOT NULL DEFAULT 0');
    await addColumnIfMissing(conn, database, 'resource_pools', 'auto_managed', 'BOOLEAN NOT NULL DEFAULT FALSE');
    await addColumnIfMissing(conn, database, 'production_orders', 'materials_taken', 'BOOLEAN NOT NULL DEFAULT FALSE');

    // Workers trained on one machine type. The factory's own workers get theirs
    // when the column is first added; everyone else stays "any machine".
    if (await addColumnIfMissing(conn, database, 'workers', 'machine_type', 'VARCHAR(60) NULL')) {
      await conn.query(
        `UPDATE \`${database}\`.workers SET machine_type = CASE skill
           WHEN 'CNC Operator' THEN 'CNC Machine' WHEN 'Assembly Lead' THEN 'Assembly'
           WHEN 'Painter' THEN 'Paint Booth' WHEN 'Welder' THEN 'Welding' END
         WHERE skill IN ('CNC Operator', 'Assembly Lead', 'Painter', 'Welder')`
      );
    }

    // Same as table 14 in database/01_schema.sql. Looked up first, so a database
    // that has it needs no CREATE privilege (a data-only user, see 06_security.sql,
    // can then start the app).
    const [[{ n: hasMaterials }]] = await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = 'order_materials'",
      [database]
    );
    if (!hasMaterials) await conn.query(
      `CREATE TABLE \`${database}\`.order_materials (
         order_id    INT NOT NULL,
         material_id INT NOT NULL,
         quantity    INT NOT NULL,
         PRIMARY KEY (order_id, material_id),
         CONSTRAINT chk_om_qty CHECK (quantity > 0),
         CONSTRAINT fk_om_order    FOREIGN KEY (order_id)    REFERENCES \`${database}\`.production_orders(order_id) ON DELETE CASCADE,
         CONSTRAINT fk_om_material FOREIGN KEY (material_id) REFERENCES \`${database}\`.inventory(material_id)      ON DELETE CASCADE
       ) ENGINE=InnoDB`
    );

    await addIndexIfMissing(conn, database, 'order_resource_claims', 'idx_claim_held', 'allocated_units, pool_id');
    await addIndexIfMissing(conn, database, 'resource_allocations', 'idx_alloc_machine_status', 'machine_id, status');
    await addIndexIfMissing(conn, database, 'resource_allocations', 'idx_alloc_worker_status', 'worker_id, status');
    await addIndexIfMissing(conn, database, 'resource_allocations', 'idx_alloc_status_machine', 'status, machine_id');

    const [triggers] = await conn.query(
      'SELECT COUNT(*) AS n FROM information_schema.triggers WHERE trigger_schema = ? AND trigger_name = ?',
      [database, NEWEST_TRIGGER]
    );
    if (triggers[0].n === 0) {
      console.log('[db] loading views, procedures and triggers...');
      await conn.query(`USE \`${database}\``);
      // A hosted database may refuse these, and so does an account that can only read
      // and write rows (it can't even see triggers, so they look missing). If an
      // admin already created them, the app works as it is, so this only warns.
      try {
        await runSqlFile(conn, '03_views.sql', database);
        await runSqlFile(conn, '04_procedures.sql', database);
        await runSqlFile(conn, '05_triggers.sql', database);
      } catch (err) {
        console.warn(`[db] could not create views, routines or triggers: ${err.message}`);
        console.warn('[db] If this account is meant to be data-only, that is fine. Otherwise run the app once with an admin account.');
      }
    }
  } finally {
    if (locked) await conn.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {});
    await conn.end();
  }
}

async function init() {
  if ((process.env.DB_MODE || '').toLowerCase() === 'memory') {
    console.log('[db] DB_MODE=memory — using the in-memory fallback store.');
    state.mode = 'memory';
    return state;
  }

  const baseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_factory',
    // Most hosted MySQL services only accept encrypted connections. Set DB_SSL=true
    // for those. If yours uses its own certificate authority and the connection is
    // refused with a certificate error, DB_SSL_VERIFY=false skips that check.
    ...(/^(1|true|yes)$/i.test(process.env.DB_SSL || '')
      ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: process.env.DB_SSL_VERIFY !== 'false' } }
      : {}),
  };

  try {
    await prepareDatabase(baseConfig);
    state.pool = mysql.createPool({
      ...baseConfig,
      waitForConnections: true,
      // Free hosted databases allow few connections in total: lower this with
      // DB_POOL_SIZE if yours does. Hosted databases also close idle connections, so
      // connections are kept alive.
      connectionLimit: Number(process.env.DB_POOL_SIZE) || 10,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
    await state.pool.query('SELECT 1');
    state.mode = 'mysql';
    state.database = baseConfig.database;
    console.log(`[db] connected to MySQL at ${baseConfig.host}:${baseConfig.port}/${baseConfig.database}`);
  } catch (err) {
    console.warn(`[db] MySQL not available (${err.code || err.message}) — falling back to the in-memory store.`);
    console.warn('[db] To use MySQL: start the server and set credentials in backend/.env');
    state.mode = 'memory';
    state.pool = null;
  }
  return state;
}

module.exports = { state, init };
