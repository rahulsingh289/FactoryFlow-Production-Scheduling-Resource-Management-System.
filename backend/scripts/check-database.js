// Tries, on the database you point it at, the things this app needs, and reports what
// works. Run it BEFORE deploying, with the same values you will give your host:
//
//   DB_HOST=... DB_PORT=... DB_USER=... DB_PASSWORD=... DB_NAME=... DB_SSL=true \
//     node scripts/check-database.js
//
// It only creates tables whose names start with ffcheck_, and drops them again. Your
// own data is never touched, and the password is never printed.
const mysql = require('mysql2/promise');

const env = process.env;
if (!env.DB_HOST || !env.DB_USER || !env.DB_NAME) {
  console.error('Set DB_HOST, DB_USER, DB_PASSWORD and DB_NAME (and DB_PORT, DB_SSL if needed) first.');
  process.exit(2);
}

const tag = `ffcheck_${Math.random().toString(36).slice(2, 7)}`;
const T1 = `${tag}_a`, T2 = `${tag}_b`, V = `${tag}_v`, TR = `${tag}_t`, PR = `${tag}_p`;

// required: the app can't run without it. optional: only a feature is lost.
const steps = [
  ['required', 'create a table', (c) => c.query(`CREATE TABLE ${T1} (id INT PRIMARY KEY, n INT NOT NULL DEFAULT 0) ENGINE=InnoDB`)],
  ['required', 'foreign key with cascade', (c) => c.query(`CREATE TABLE ${T2} (id INT PRIMARY KEY, p INT NOT NULL, CONSTRAINT ${tag}_fk FOREIGN KEY (p) REFERENCES ${T1}(id) ON DELETE CASCADE) ENGINE=InnoDB`)],
  ['required', 'add an index later (ALTER TABLE)', (c) => c.query(`ALTER TABLE ${T2} ADD INDEX ${tag}_i (p)`)],
  ['required', 'create a view', (c) => c.query(`CREATE VIEW ${V} AS SELECT a.id, COUNT(b.id) AS kids FROM ${T1} a LEFT JOIN ${T2} b ON b.p = a.id GROUP BY a.id`)],
  ['required', 'write and read rows', async (c) => {
    await c.query(`INSERT INTO ${T1} (id, n) VALUES (1, 5)`);
    await c.query(`INSERT INTO ${T2} (id, p) VALUES (1, 1)`);
    const [[r]] = await c.query(`SELECT kids FROM ${V} WHERE id = 1`);
    if (Number(r.kids) !== 1) throw new Error('view returned the wrong answer');
  }],
  ['required', 'transaction with a row lock', async (c) => {
    await c.beginTransaction();
    await c.query(`SELECT * FROM ${T1} WHERE id = 1 FOR UPDATE`);
    await c.query(`UPDATE ${T1} SET n = n + 1 WHERE id = 1`);
    await c.commit();
  }],
  ['optional', 'setup lock (GET_LOCK), stops two servers building the tables at once', async (c) => {
    const [[r]] = await c.query(`SELECT GET_LOCK('${tag}', 2) AS got`);
    if (r.got !== 1) throw new Error('lock not granted');
    await c.query(`SELECT RELEASE_LOCK('${tag}')`);
  }],
  ['optional', 'create a trigger (fills the stock history)', (c) => c.query(`CREATE TRIGGER ${TR} AFTER INSERT ON ${T1} FOR EACH ROW SET @ffcheck = NEW.id`)],
  ['optional', 'create a stored procedure (database viva demo)', (c) => c.query(`CREATE PROCEDURE ${PR}() BEGIN SELECT 1; END`)],
];

(async () => {
  let c;
  try {
    c = await mysql.createConnection({
      host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER, password: env.DB_PASSWORD || '', database: env.DB_NAME,
      ssl: /^(1|true|yes)$/i.test(env.DB_SSL || '') ? { minVersion: 'TLSv1.2', rejectUnauthorized: env.DB_SSL_VERIFY !== 'false' } : undefined,
      connectTimeout: 15000,
    });
  } catch (e) {
    const where = e.message || (e.errors || []).map((x) => `${x.address}:${x.port}`).join(' and ');
    const hint = {
      ENOTFOUND: 'the host name is wrong',
      ECONNREFUSED: 'nothing is listening there: check the host and port',
      ETIMEDOUT: 'no answer: check the host and port, and that the database accepts outside connections',
      ER_ACCESS_DENIED_ERROR: 'wrong user name or password',
      ER_DBACCESS_DENIED_ERROR: 'this user may not use that database name',
      ER_BAD_DB_ERROR: 'that database name does not exist',
    }[e.code] || (/ssl|tls|secure/i.test(where) ? 'encryption problem: try DB_SSL=true DB_SSL_VERIFY=false, or leave DB_SSL unset' : '');
    console.log(`\nCONNECTING ... FAILED  ${e.code || ''} ${hint ? `(${hint})` : where.slice(0, 120)}`);
    process.exit(1);
  }

  const [[v]] = await c.query('SELECT VERSION() AS v');
  const [cipher] = await c.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
  console.log(`\nCONNECTING ... ok   MySQL ${v.v}, ${cipher[0] && cipher[0].Value ? 'encrypted' : 'NOT encrypted'}\n`);

  let requiredFailed = [], optionalMissing = [];
  for (const [kind, label, run] of steps) {
    try { await run(c); console.log(`  ok      ${label}`); }
    catch (e) {
      // A step that only failed because an earlier one did is not a separate problem.
      if (e.code === 'ER_NO_SUCH_TABLE' && requiredFailed.length) { console.log(`  skipped ${label}  (needs the step above)`); continue; }
      console.log(`  ${kind === 'required' ? 'FAILED ' : 'missing'} ${label}  (${e.code || e.message.slice(0, 60)})`);
      (kind === 'required' ? requiredFailed : optionalMissing).push(label);
      if (c._fatalError) break;
    }
  }

  // Remove everything this check made, ignoring what was never created.
  for (const sql of [`DROP PROCEDURE IF EXISTS ${PR}`, `DROP TRIGGER IF EXISTS ${TR}`, `DROP VIEW IF EXISTS ${V}`, `DROP TABLE IF EXISTS ${T2}`, `DROP TABLE IF EXISTS ${T1}`]) {
    try { await c.query(sql); } catch { /* nothing to remove */ }
  }
  await c.end();

  console.log('');
  if (requiredFailed.length) {
    console.log(`RESULT: this database can NOT run the app. It does not allow: ${requiredFailed.join('; ')}.`);
    process.exit(1);
  }
  console.log('RESULT: this database CAN run the app.');
  if (optionalMissing.length) console.log(`        Not available here (only these features are lost): ${optionalMissing.join('; ')}.`);
  else console.log('        Everything is available, including triggers and stored procedures.');
})();
