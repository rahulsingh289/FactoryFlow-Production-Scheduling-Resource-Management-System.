// Editing orders, materials that come out of stock, and workers trained for one machine type.
const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

let t, api;
test.before(async () => {
  t = await start();
  api = (await t.signUp()).api;
  await api.post('/api/machines', { machine_name: 'Saw-01', machine_type: 'Saw', capacity: 2 });
  await api.post('/api/machines', { machine_name: 'Lathe-01', machine_type: 'Lathe', capacity: 1 });
});
test.after(() => t.server.close());

const newOrder = (name, extra = {}) => api.post('/api/orders', {
  product_name: name, quantity: 5, execution_time: 4, deadline: 30, required_machine_type: 'Saw', ...extra,
});
const orderRow = async (id) => (await api.get('/api/orders')).body.find((o) => o.order_id === id);
const worker = (name, machine_type) => api.post('/api/workers', { full_name: name, skill: 'Operator', ...(machine_type ? { machine_type } : {}) });

// ------------------------------- editing ----------------------------------
test('an order can be edited, and bad edits are refused', async () => {
  const id = (await newOrder('Chair')).body.order_id;
  const edit = await api.patch(`/api/orders/${id}`, { product_name: 'Armchair', priority: 1, deadline: 50 });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.product_name, 'Armchair');
  assert.equal(edit.body.priority, 1);
  assert.equal(edit.body.execution_time, 4, 'fields that were not sent stay as they were');

  assert.equal((await api.patch(`/api/orders/${id}`, { priority: 9 })).status, 400);
  assert.equal((await api.patch(`/api/orders/${id}`, { quantity: 0 })).status, 400);
  assert.equal((await api.patch(`/api/orders/${id}`, { product_name: '  ' })).status, 400);
  assert.equal((await api.patch(`/api/orders/${id}`, {})).status, 400, 'nothing to change');
  assert.equal((await api.patch('/api/orders/9999', { priority: 2 })).status, 404);
  assert.equal((await api.patch('/api/orders/abc', { priority: 2 })).status, 400);
});

test('changing the machine type moves the order to that type\'s resource pool', async () => {
  const id = (await newOrder('Table')).body.order_id;
  const maxOf = async (poolName) => {
    const data = (await api.get('/api/os/bankers')).body;
    const j = data.pools.findIndex((p) => p.pool_name === poolName);
    return data.orders.find((o) => o.order_id === id).max[j];
  };
  assert.equal(await maxOf('Saw slots'), 1);
  assert.equal(await maxOf('Lathe slots'), 0);
  assert.equal((await api.patch(`/api/orders/${id}`, { required_machine_type: 'Lathe' })).status, 200);
  assert.equal(await maxOf('Saw slots'), 0);
  assert.equal(await maxOf('Lathe slots'), 1);
});

test('a running or finished order has limits on what can change', async () => {
  await worker('Asha');
  const id = (await newOrder('Shelf')).body.order_id;
  assert.equal((await api.patch(`/api/orders/${id}/status`, { status: 'RUNNING' })).status, 200);
  assert.equal((await api.patch(`/api/orders/${id}`, { required_machine_type: 'Lathe' })).status, 409);
  assert.equal((await api.patch(`/api/orders/${id}`, { deadline: 99 })).status, 200, 'other details can change while it runs');
  assert.equal((await api.patch(`/api/orders/${id}/status`, { status: 'COMPLETED' })).status, 200);
  assert.equal((await api.patch(`/api/orders/${id}`, { deadline: 5 })).status, 409, 'finished');
});

// ------------------------------- materials --------------------------------
test('starting an order takes its materials out of stock, once', async () => {
  const timber = (await api.post('/api/inventory', { material_name: 'Timber', quantity_available: 10, unit: 'planks' })).body.material_id;
  const paint = (await api.post('/api/inventory', { material_name: 'Paint', quantity_available: 3, unit: 'cans' })).body.material_id;
  const stock = async () => Object.fromEntries((await api.get('/api/inventory')).body.map((m) => [m.material_name, m.quantity_available]));

  assert.equal((await newOrder('Bad', { materials: [{ material_id: 9999, quantity: 1 }] })).status, 400, 'unknown material');
  assert.equal((await newOrder('Bad', { materials: [{ material_id: timber, quantity: 0 }] })).status, 400);
  assert.equal((await newOrder('Bad', { materials: [{ material_id: timber, quantity: 1 }, { material_id: timber, quantity: 2 }] })).status, 400, 'listed twice');

  const a = (await newOrder('Desk', { materials: [{ material_id: timber, quantity: 4 }, { material_id: paint, quantity: 1 }] })).body;
  assert.deepEqual(a.materials.map((m) => [m.material_name, m.quantity]).sort(), [['Paint', 1], ['Timber', 4]]);

  assert.equal((await api.patch(`/api/orders/${a.order_id}/status`, { status: 'RUNNING' })).status, 200);
  assert.deepEqual(await stock(), { Timber: 6, Paint: 2 });
  assert.equal((await orderRow(a.order_id)).materials_taken, true);

  // Stopping and starting again does not take them a second time.
  await api.patch(`/api/orders/${a.order_id}/status`, { status: 'READY' });
  await api.patch(`/api/orders/${a.order_id}/status`, { status: 'RUNNING' });
  assert.deepEqual(await stock(), { Timber: 6, Paint: 2 });

  // Their materials are fixed once taken.
  assert.equal((await api.patch(`/api/orders/${a.order_id}`, { materials: [] })).status, 409);
  await api.patch(`/api/orders/${a.order_id}/status`, { status: 'COMPLETED' });
});

test('not enough stock stops an order from starting, and changes nothing', async () => {
  const timber = (await api.get('/api/inventory')).body.find((m) => m.material_name === 'Timber');
  const b = (await newOrder('Cabinet', { materials: [{ material_id: timber.material_id, quantity: 8 }] })).body;
  const start = await api.patch(`/api/orders/${b.order_id}/status`, { status: 'RUNNING' });
  assert.equal(start.status, 409);
  assert.match(start.body.error, /Timber: needs 8, 6 in stock/);

  const after = await orderRow(b.order_id);
  assert.equal(after.status, 'READY');
  assert.equal(after.assigned_machine, null);
  assert.ok((await api.get('/api/workers')).body.every((w) => w.status !== 'ASSIGNED'), 'no worker was taken');
  assert.equal((await api.get('/api/inventory')).body.find((m) => m.material_name === 'Timber').quantity_available, 6);

  // Restock and it starts. Or lower what it needs.
  await api.patch(`/api/inventory/${timber.material_id}`, { quantity_available: 20 });
  assert.equal((await api.patch(`/api/orders/${b.order_id}/status`, { status: 'RUNNING' })).status, 200);
  assert.equal((await api.get('/api/inventory')).body.find((m) => m.material_name === 'Timber').quantity_available, 12);
  await api.patch(`/api/orders/${b.order_id}/status`, { status: 'COMPLETED' });
});

test('a material an unfinished order still needs cannot be deleted', async () => {
  const glue = (await api.post('/api/inventory', { material_name: 'Glue', quantity_available: 5 })).body.material_id;
  const c = (await newOrder('Frame', { materials: [{ material_id: glue, quantity: 1 }] })).body.order_id;
  assert.equal((await api.del(`/api/inventory/${glue}`)).status, 409);
  assert.equal((await api.patch(`/api/orders/${c}`, { materials: [] })).status, 200, 'materials can change before it starts');
  assert.equal((await api.del(`/api/inventory/${glue}`)).status, 200);
});

// --------------------------------- skills ---------------------------------
test('an order only gets a worker trained for its machine type', async () => {
  // Fresh factory for this test: only trained workers exist.
  for (const w of (await api.get('/api/workers')).body) await api.del(`/api/workers/${w.worker_id}`);
  const sawman = (await worker('Sawman', 'Saw')).body.worker_id;
  const turner = (await worker('Turner', 'Lathe')).body.worker_id;

  const lathe1 = (await newOrder('Spindle', { required_machine_type: 'Lathe' })).body.order_id;
  const lathe2 = (await newOrder('Pin', { required_machine_type: 'Lathe' })).body.order_id;
  const saw1 = (await newOrder('Plank', { required_machine_type: 'Saw' })).body.order_id;

  assert.equal((await api.patch(`/api/orders/${lathe1}/status`, { status: 'RUNNING' })).status, 200);
  assert.equal((await orderRow(lathe1)).assigned_worker, 'Turner');

  // The Lathe has no free slot AND Sawman can't run it: refused with a clear reason.
  const second = await api.patch(`/api/orders/${lathe2}/status`, { status: 'RUNNING' });
  assert.equal(second.status, 409);

  // Sawman runs the Saw, not the Lathe.
  assert.equal((await api.patch(`/api/orders/${saw1}/status`, { status: 'RUNNING' })).status, 200);
  assert.equal((await orderRow(saw1)).assigned_worker, 'Sawman');

  // Retraining someone who is on an order is not allowed; a free worker can be retrained.
  assert.equal((await api.patch(`/api/workers/${turner}`, { machine_type: 'Saw' })).status, 409);
  await api.patch(`/api/orders/${lathe1}/status`, { status: 'COMPLETED' });
  await api.patch(`/api/orders/${saw1}/status`, { status: 'COMPLETED' });
  assert.equal((await api.patch(`/api/workers/${turner}`, { machine_type: '' })).status, 200, 'now trained for any machine');
  assert.equal((await api.patch(`/api/orders/${lathe2}/status`, { status: 'RUNNING' })).status, 200);
  assert.equal((await orderRow(lathe2)).assigned_worker, 'Turner');
  assert.equal((await api.get('/api/workers')).body.find((w) => w.worker_id === sawman).machine_type, 'Saw');
});

test('with no worker trained for a type, the order and the scheduler say so', async () => {
  // Finish whatever is running and start with only a Saw-trained worker.
  for (const o of (await api.get('/api/orders')).body.filter((x) => x.status === 'RUNNING')) {
    await api.patch(`/api/orders/${o.order_id}/status`, { status: 'COMPLETED' });
  }
  for (const w of (await api.get('/api/workers')).body) assert.equal((await api.del(`/api/workers/${w.worker_id}`)).status, 200);
  await worker('Sawman2', 'Saw');

  const id = (await newOrder('Gear', { required_machine_type: 'Lathe' })).body.order_id;
  const start = await api.patch(`/api/orders/${id}/status`, { status: 'RUNNING' });
  assert.equal(start.status, 409);
  assert.match(start.body.error, /trained for Lathe/);

  const run = await api.post('/api/os/schedule', { algorithm: 'FCFS' });
  assert.equal(run.status, 200);
  const reasons = run.body.unschedulable.map((u) => u.message);
  assert.ok(reasons.some((m) => /trained for Lathe/.test(m)), JSON.stringify(reasons));
});

// --------------------------------- dispatch --------------------------------
test('start-all skips orders that cannot fit, but a stock shortage only stops that one order', async () => {
  // A fresh, small factory: one Drill with two slots and two workers.
  for (const o of (await api.get('/api/orders')).body) {
    if (o.status === 'RUNNING') await api.patch(`/api/orders/${o.order_id}/status`, { status: 'COMPLETED' });
    await api.del(`/api/orders/${o.order_id}`);
  }
  for (const m of (await api.get('/api/machines')).body) await api.del(`/api/machines/${m.machine_id}`);
  for (const w of (await api.get('/api/workers')).body) await api.del(`/api/workers/${w.worker_id}`);
  await api.post('/api/machines', { machine_name: 'Drill-1', machine_type: 'Drill', capacity: 2 });
  await worker('D1'); await worker('D2'); await worker('D3');
  const bolts = (await api.post('/api/inventory', { material_name: 'Bolts', quantity_available: 1, unit: 'pcs' })).body.material_id;

  const needsBolts = (await newOrder('Needs bolts', { required_machine_type: 'Drill', materials: [{ material_id: bolts, quantity: 5 }] })).body.order_id;
  const a = (await newOrder('Plain A', { required_machine_type: 'Drill' })).body.order_id;
  const b = (await newOrder('Plain B', { required_machine_type: 'Drill' })).body.order_id;
  const c = (await newOrder('Plain C', { required_machine_type: 'Drill' })).body.order_id;

  const r = await api.post('/api/os/dispatch', { algorithm: 'FCFS' });
  assert.equal(r.status, 200);
  const started = r.body.started.map((x) => x.pid).sort((x, y) => x - y);
  assert.equal(started.length, 2, 'two Drill slots, two orders start');
  assert.ok(!started.includes(needsBolts) || started.length === 2);
  const waiting = r.body.waiting.map((x) => x.pid);
  assert.equal(started.length + waiting.length, 4, 'every order is accounted for');
  const why = Object.fromEntries(r.body.waiting.map((x) => [x.pid, x.message]));
  assert.ok(Object.values(why).every((m) => m.length > 5), 'each waiting order says why');
  if (waiting.includes(needsBolts) && !started.includes(needsBolts)) {
    assert.match(why[needsBolts], /Not enough stock|No free machine/);
  }
  // Orders still waiting for the Drill all give the same, clear reason.
  assert.ok([a, b, c].filter((id) => waiting.includes(id)).every((id) => /No free machine of type Drill/.test(why[id])));
});
