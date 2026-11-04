// ---------------------------------------------------------------------------
// In-memory data store — used only as a fallback when MySQL is not reachable.
// It starts empty, and data created here is not persisted.
// When MySQL is configured in backend/.env the app uses MySQL instead.
// ---------------------------------------------------------------------------
function freshData() {
  return {
    users: [],
    machines: [],
    workers: [],
    inventory: [],
    orders: [],
    orderMaterials: [],   // { order_id, material_id, quantity }
    pools: [],
    claims: [],
    allocations: [],
    scheduleRuns: [],
    seq: { order: 0, run: 0, machine: 0, worker: 0, material: 0, pool: 0, user: 0, allocation: 0 },
  };
}

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = { freshData, now };
