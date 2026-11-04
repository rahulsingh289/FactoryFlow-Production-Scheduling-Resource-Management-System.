// End-to-end tests for the REST API. The server runs in memory mode, so no MySQL
// is needed:   cd backend && npm test
process.env.DB_MODE = 'memory';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

let server, base, token;

test.before(async () => {
  const app = await createApp();
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

async function call(method, path, body, auth = true) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const get = (p) => call('GET', p);
const post = (p, b) => call('POST', p, b);
const patch = (p, b) => call('PATCH', p, b);
const del = (p) => call('DELETE', p);

const order = (name, extra = {}) => post('/api/orders', {
  product_name: name, quantity: 5, execution_time: 4, deadline: 30, required_machine_type: 'Saw', ...extra,
});

test('health works without signing in', async () => {
  const r = await call('GET', '/api/health', null, false);
  assert.equal(r.status, 200);
  assert.equal(r.body.dbMode, 'memory');
});

test('everything but auth and health needs a token', async () => {
  for (const path of ['/api/orders', '/api/machines', '/api/os/bankers', '/api/reports/dashboard']) {
    assert.equal((await call('GET', path, null, false)).status, 401, path);
  }
});

test('register, reject duplicates and bad input, sign in', async () => {
  const good = { full_name: 'Test User', username: 'tester', email: 'tester@example.com', password: 'secret1' };
  const reg = await call('POST', '/api/auth/register', good, false);
  assert.equal(reg.status, 201);
  token = reg.body.token;

  assert.equal((await call('POST', '/api/auth/register', good, false)).status, 409);
  assert.equal((await call('POST', '/api/auth/register', { ...good, username: 'x', email: 'bad' }, false)).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { ...good, username: 'other', email: 'o@example.com', password: '123' }, false)).status, 400);

  assert.equal((await call('POST', '/api/auth/login', { username: 'tester', password: 'wrong' }, false)).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { username: 'nobody', password: 'secret1' }, false)).status, 401);
  const login = await call('POST', '/api/auth/login', { username: 'Tester', password: 'secret1' }, false);
  assert.equal(login.status, 200);
  token = login.body.token;
  assert.equal((await get('/api/auth/me')).body.username, 'tester');
});

test('machines and workers: add, validate, change status, delete', async () => {
  assert.equal((await post('/api/machines', { machine_name: '', machine_type: 'Saw' })).status, 400);
  assert.equal((await post('/api/machines', { machine_name: 'Saw-01', machine_type: 'Saw', capacity: 0 })).status, 400);
  assert.equal((await post('/api/machines', { machine_name: 'Saw-01', machine_type: 'Saw', capacity: 2 })).status, 201);
  assert.equal((await post('/api/machines', { machine_name: 'Lathe-01', machine_type: 'Lathe', capacity: 1 })).status, 201);
  assert.equal((await post('/api/workers', { full_name: 'Asha', skill: 'Operator' })).status, 201);
  assert.equal((await post('/api/workers', { full_name: 'Ravi', skill: 'Operator' })).status, 201);

  const lathe = (await get('/api/machines')).body.find((m) => m.machine_name === 'Lathe-01');
  assert.equal((await patch(`/api/machines/${lathe.machine_id}/status`, { status: 'BUSY' })).status, 400, 'BUSY is derived, not settable');
  assert.equal((await patch(`/api/machines/${lathe.machine_id}/status`, { status: 'MAINTENANCE' })).status, 200);
  assert.equal((await patch('/api/machines/abc/status', { status: 'AVAILABLE' })).status, 400);
  assert.equal((await patch('/api/machines/9999/status', { status: 'AVAILABLE' })).status, 404);
  assert.equal((await patch(`/api/machines/${lathe.machine_id}/status`, { status: 'AVAILABLE' })).status, 200);
  assert.equal((await del(`/api/machines/${lathe.machine_id}`)).status, 200);
  assert.equal((await del(`/api/machines/${lathe.machine_id}`)).status, 404);
});

test('order input is validated', async () => {
  assert.equal((await post('/api/orders', { product_name: 'X' })).status, 400);
  assert.equal((await order('X', { quantity: -1 })).status, 400);
  assert.equal((await order('X', { execution_time: 0 })).status, 400);
  assert.equal((await order('X', { priority: 9 })).status, 400);
  assert.equal((await order('X', { quantity: 1.5 })).status, 400);
});

let a, b, c;
test('starting orders takes a machine slot and a worker, and runs out', async () => {
  a = (await order('Chair')).body.order_id;
  b = (await order('Desk')).body.order_id;
  c = (await order('Shelf')).body.order_id;

  assert.equal((await patch(`/api/orders/${a}/status`, { status: 'COMPLETED' })).status, 409, 'READY cannot jump to COMPLETED');
  assert.equal((await patch(`/api/orders/${a}/status`, { status: 'RUNNING' })).status, 200);
  assert.equal((await patch(`/api/orders/${b}/status`, { status: 'RUNNING' })).status, 200);
  const third = await patch(`/api/orders/${c}/status`, { status: 'RUNNING' });
  assert.equal(third.status, 409, 'the Saw has 2 slots and there are 2 workers');

  const orders = (await get('/api/orders')).body;
  assert.equal(orders.find((o) => o.order_id === a).assigned_machine, 'Saw-01');
  assert.notEqual(orders.find((o) => o.order_id === a).assigned_worker, orders.find((o) => o.order_id === b).assigned_worker);
});

test('a machine or worker that is in use cannot be taken away', async () => {
  const saw = (await get('/api/machines')).body.find((m) => m.machine_name === 'Saw-01');
  assert.equal((await patch(`/api/machines/${saw.machine_id}/status`, { status: 'MAINTENANCE' })).status, 409);
  assert.equal((await del(`/api/machines/${saw.machine_id}`)).status, 409);
  const busy = (await get('/api/workers')).body.find((w) => w.status === 'ASSIGNED');
  assert.equal((await patch(`/api/workers/${busy.worker_id}/status`, { status: 'OFF_SHIFT' })).status, 409);
  assert.equal((await del(`/api/workers/${busy.worker_id}`)).status, 409);
});

test('resource pools follow the factory and the running orders', async () => {
  const pools = (await get('/api/pools')).body;
  const slots = pools.find((p) => p.pool_name === 'Saw slots');
  const workers = pools.find((p) => p.pool_name === 'Workers');
  assert.equal(slots.total_units, 2);
  assert.equal(slots.available_units, 0);
  assert.equal(workers.total_units, 2);
  assert.equal(workers.available_units, 0);
});

test("Banker's: matrix, request rules, forced deadlock and recovery", async () => {
  const data = (await get('/api/os/bankers')).body;
  assert.equal(data.orders.length, 3);
  const row = (id) => data.orders.find((o) => o.order_id === id);
  assert.deepEqual(row(a).alloc, row(a).max, 'a running order holds its maximum');

  // c is READY and holds nothing, but nothing is free: it must wait.
  const wait = await post('/api/os/bankers/request', { order_id: c, units: data.pools.map(() => 1), action: 'grant' });
  assert.equal(wait.status, 200);
  assert.equal(wait.body.outcome, 'WAITING');

  // Asking for more than the maximum is refused.
  const over = await post('/api/os/bankers/request', { order_id: c, units: data.pools.map(() => 5), action: 'check' });
  assert.equal(over.body.outcome, 'REFUSED');

  // Bad input.
  assert.equal((await post('/api/os/bankers/request', { order_id: c, units: [0, 0], action: 'check' })).status, 400);
  assert.equal((await post('/api/os/bankers/request', { order_id: c, units: [1], action: 'nope' })).status, 400);
  assert.equal((await post('/api/os/bankers/request', { order_id: 9999, units: data.pools.map(() => 1), action: 'check' })).status, 404);

  // c now waits for units that a and b hold while they wait on nothing, so no deadlock yet.
  assert.equal((await get('/api/os/deadlock')).body.deadlocked, false);

  // Releasing a running order hands everything back and returns it to READY.
  assert.equal((await post('/api/os/bankers/release', { order_id: a })).status, 200);
  const after = (await get('/api/orders')).body.find((o) => o.order_id === a);
  assert.equal(after.status, 'READY');
  assert.equal(after.assigned_machine, null);
  const slots = (await get('/api/pools')).body.find((p) => p.pool_name === 'Saw slots');
  assert.equal(slots.available_units, 1);
});

test('changing a Maximum is limited to what is held and what exists', async () => {
  const data = (await get('/api/os/bankers')).body;
  const slotPool = data.pools.find((p) => p.pool_name === 'Saw slots');
  assert.equal((await patch('/api/os/bankers/claims', { order_id: b, pool_id: slotPool.pool_id, max_units: 0 })).status, 409, 'below what b already holds');
  assert.equal((await patch('/api/os/bankers/claims', { order_id: c, pool_id: slotPool.pool_id, max_units: 99 })).status, 409, 'more than exist');
  assert.equal((await patch('/api/os/bankers/claims', { order_id: c, pool_id: slotPool.pool_id, max_units: 2 })).status, 200);
});

test('the scheduler plans, records the run and lists it', async () => {
  const bad = await post('/api/os/schedule', { algorithm: 'NOPE' });
  assert.equal(bad.status, 400);
  const run = await post('/api/os/schedule', { algorithm: 'SJF' });
  assert.equal(run.status, 200);
  assert.ok(run.body.processes.length >= 2);
  assert.ok(run.body.runId);
  const runs = (await get('/api/reports/schedule-runs?limit=5')).body;
  assert.equal(runs[0].run_id, run.body.runId);
  assert.equal(runs[0].algorithm, 'SJF');

  const cmp = await post('/api/os/compare', { quantum: 2 });
  assert.equal(cmp.body.rows.length, 6);
});

test('dispatch starts what fits and says what could not start', async () => {
  const r = await post('/api/os/dispatch', { algorithm: 'FCFS' });
  assert.equal(r.status, 200);
  assert.equal(r.body.started.length + r.body.waiting.length, 2, 'a and c are READY');
});

test('finishing or deleting an order gives its machine and worker back', async () => {
  const running = (await get('/api/orders')).body.filter((o) => o.status === 'RUNNING');
  assert.ok(running.length >= 1);
  for (const o of running) assert.equal((await patch(`/api/orders/${o.order_id}/status`, { status: 'COMPLETED' })).status, 200);
  assert.equal((await patch(`/api/orders/${running[0].order_id}/status`, { status: 'READY' })).status, 409, 'COMPLETED is final');
  assert.equal((await del(`/api/orders/${b}`)).status, 200);
  assert.equal((await del(`/api/orders/${b}`)).status, 404);
  assert.equal((await del(`/api/orders/${a}`)).status, 200);
  assert.equal((await del(`/api/orders/${c}`)).status, 200);

  const workers = (await get('/api/workers')).body;
  assert.ok(workers.every((w) => w.status === 'AVAILABLE'));
  const pools = (await get('/api/pools')).body;
  assert.ok(pools.every((p) => p.available_units === p.total_units), 'every unit is back');
});

test('inventory and custom pools', async () => {
  assert.equal((await post('/api/inventory', { material_name: '' })).status, 400);
  const item = await post('/api/inventory', { material_name: 'Timber', quantity_available: 10, unit: 'planks' });
  assert.equal(item.status, 201);
  assert.equal((await patch(`/api/inventory/${item.body.material_id}`, { quantity_available: -3 })).status, 400);
  assert.equal((await patch(`/api/inventory/${item.body.material_id}`, { quantity_available: 4 })).status, 200);
  assert.equal((await patch('/api/inventory/9999', { quantity_available: 4 })).status, 404);
  assert.equal((await get('/api/inventory')).body[0].quantity_available, 4);

  assert.equal((await post('/api/pools', { pool_name: 'Tooling kits', total_units: -1 })).status, 400);
  const pool = await post('/api/pools', { pool_name: 'Tooling kits', total_units: 3 });
  assert.equal(pool.status, 201);
  assert.equal((await del(`/api/pools/${pool.body.pool_id}`)).status, 200);
  assert.ok(!(await get('/api/pools')).body.some((p) => p.pool_name === 'Tooling kits'));
  assert.equal((await del(`/api/inventory/${item.body.material_id}`)).status, 200);
  assert.equal((await get('/api/inventory')).body.length, 0);
});

test('the order list stays small, counts are complete, and safety is one call', async () => {
  await post('/api/machines', { machine_name: 'Press-01', machine_type: 'Press', capacity: 40 });
  await post('/api/workers', { full_name: 'Bulk Worker', skill: 'Operator' });
  const ids = [];
  for (let i = 0; i < 30; i++) {
    const id = (await order(`Finished ${i}`, { required_machine_type: 'Press' })).body.order_id;
    assert.equal((await patch(`/api/orders/${id}/status`, { status: 'RUNNING' })).status, 200);
    assert.equal((await patch(`/api/orders/${id}/status`, { status: 'COMPLETED' })).status, 200);
    ids.push(id);
  }
  const open = (await order('Still open', { required_machine_type: 'Press' })).body.order_id;

  const list = (await get('/api/orders')).body;
  assert.equal(list.filter((o) => o.status === 'COMPLETED').length, 25, 'only the newest 25 finished orders');
  assert.ok(list.some((o) => o.order_id === open), 'every unfinished order is there');
  assert.ok(list.some((o) => o.order_id === ids[29]) && !list.some((o) => o.order_id === ids[0]), 'the newest, not the oldest');

  const all = (await get('/api/orders?finished=all')).body;
  assert.ok(all.some((o) => o.order_id === ids[0]));
  const counts = (await get('/api/orders/counts')).body;
  assert.ok(counts.COMPLETED >= 30 && counts.READY >= 1);
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), all.length, 'counts cover every order');

  const safety = (await get('/api/os/safety')).body;
  assert.equal(typeof safety.safe, 'boolean');
  assert.equal(typeof safety.deadlock.deadlocked, 'boolean');
  assert.ok(Array.isArray(safety.orders) && Array.isArray(safety.pools));
  assert.ok(!safety.orders.some((o) => o.status === 'COMPLETED'), 'finished orders are not in the matrices');

  const dash = (await get('/api/reports/dashboard')).body;
  assert.equal(dash.totalOrders, all.length);
  assert.ok(Array.isArray(dash.machines) && Array.isArray(dash.workers));
});
