// A view-only account (OPERATOR) can look and run orders but not change the factory.
process.env.MANAGER_CODE = 'open-sesame';
const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

let t, boss, viewer;
test.before(async () => {
  t = await start();
  boss = (await t.signUp({ manager_code: 'open-sesame' }));
  viewer = (await t.signUp());
});
test.after(() => t.server.close());

test('the sign-up form is told a manager code exists', async () => {
  assert.deepEqual((await t.client().get('/api/auth/options')).body, { managerCode: true });
});

test('the right code makes a manager, no code a view-only account, a wrong code is refused', async () => {
  assert.equal(boss.body.user.role, 'MANAGER');
  assert.equal(viewer.body.user.role, 'OPERATOR');
  const wrong = await t.signUp({ manager_code: 'guess' });
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.error, /manager code/i);
});

test('a view-only account can read everything', async () => {
  for (const path of ['/api/orders', '/api/machines', '/api/workers', '/api/inventory', '/api/pools', '/api/os/bankers', '/api/os/deadlock', '/api/reports/dashboard']) {
    assert.equal((await viewer.api.get(path)).status, 200, path);
  }
});

test('a view-only account cannot change how the factory is set up', async () => {
  const attempts = [
    viewer.api.post('/api/orders', { product_name: 'X', quantity: 1, execution_time: 1, deadline: 5 }),
    viewer.api.post('/api/machines', { machine_name: 'M', machine_type: 'Saw' }),
    viewer.api.post('/api/workers', { full_name: 'W', skill: 'S' }),
    viewer.api.post('/api/inventory', { material_name: 'Timber' }),
    viewer.api.post('/api/pools', { pool_name: 'Kits', total_units: 1 }),
    viewer.api.patch('/api/machines/1/status', { status: 'MAINTENANCE' }),
    viewer.api.patch('/api/orders/1', { priority: 1 }),
    viewer.api.del('/api/orders/1'),
    viewer.api.del('/api/machines/1'),
    viewer.api.post('/api/os/bankers/release', { order_id: 1 }),
    viewer.api.patch('/api/os/bankers/claims', { order_id: 1, pool_id: 1, max_units: 1 }),
    viewer.api.post('/api/os/bankers/request', { order_id: 1, units: [1], action: 'grant' }),
    viewer.api.post('/api/os/bankers/request', { order_id: 1, units: [1], action: 'force' }),
  ];
  for (const r of await Promise.all(attempts)) {
    assert.equal(r.status, 403);
    assert.match(r.body.error, /view-only/);
  }
});

test('a view-only account can start and finish orders, run the scheduler and test a request', async () => {
  await boss.api.post('/api/machines', { machine_name: 'Saw-01', machine_type: 'Saw', capacity: 1 });
  await boss.api.post('/api/workers', { full_name: 'Asha', skill: 'Operator' });
  const id = (await boss.api.post('/api/orders', { product_name: 'Chair', quantity: 1, execution_time: 3, deadline: 20, required_machine_type: 'Saw' })).body.order_id;

  assert.equal((await viewer.api.patch(`/api/orders/${id}/status`, { status: 'RUNNING' })).status, 200);
  assert.equal((await viewer.api.post('/api/os/schedule', { algorithm: 'FCFS' })).status, 200);
  assert.equal((await viewer.api.post('/api/os/compare', {})).status, 200);
  const pools = (await viewer.api.get('/api/os/bankers')).body.pools;
  const check = await viewer.api.post('/api/os/bankers/request', { order_id: id, units: pools.map(() => 0).fill(1, 0, 1), action: 'check' });
  assert.equal(check.status, 200);
  assert.equal((await viewer.api.patch(`/api/orders/${id}/status`, { status: 'COMPLETED' })).status, 200);
});

test('a manager can do all of it', async () => {
  assert.equal((await boss.api.post('/api/inventory', { material_name: 'Timber' })).status, 201);
  assert.equal((await boss.api.post('/api/pools', { pool_name: 'Kits', total_units: 2 })).status, 201);
});
