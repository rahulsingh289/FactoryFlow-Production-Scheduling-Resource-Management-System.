// ---------------------------------------------------------------------------
// In-memory demo dataset. Mirrors database/seed.sql so the website behaves the
// same whether or not MySQL is installed. Used only when mode === 'memory'.
// ---------------------------------------------------------------------------
function freshData() {
  return {
    users: [], // filled by ensureDefaultUsers()
    machines: [
      { machine_id: 1, machine_name: 'CNC-01', machine_type: 'CNC Machine', capacity: 2, status: 'AVAILABLE' },
      { machine_id: 2, machine_name: 'CNC-02', machine_type: 'CNC Machine', capacity: 1, status: 'AVAILABLE' },
      { machine_id: 3, machine_name: 'Assembly-01', machine_type: 'Assembly', capacity: 3, status: 'AVAILABLE' },
      { machine_id: 4, machine_name: 'Paint-01', machine_type: 'Paint Booth', capacity: 1, status: 'MAINTENANCE' },
      { machine_id: 5, machine_name: 'Weld-01', machine_type: 'Welding', capacity: 2, status: 'AVAILABLE' },
    ],
    workers: [
      { worker_id: 1, full_name: 'Ravi Kumar', skill: 'CNC Operator', status: 'AVAILABLE' },
      { worker_id: 2, full_name: 'Sunita Devi', skill: 'Assembly Lead', status: 'AVAILABLE' },
      { worker_id: 3, full_name: 'Amit Sharma', skill: 'Painter', status: 'OFF_SHIFT' },
      { worker_id: 4, full_name: 'Neha Verma', skill: 'Welder', status: 'AVAILABLE' },
      { worker_id: 5, full_name: 'Karan Mehta', skill: 'Quality Inspector', status: 'ASSIGNED' },
    ],
    inventory: [
      { material_id: 1, material_name: 'Timber Plank', quantity_available: 120, reorder_level: 40, unit: 'pieces' },
      { material_id: 2, material_name: 'Steel Sheet', quantity_available: 60, reorder_level: 25, unit: 'sheets' },
      { material_id: 3, material_name: 'Wood Screw', quantity_available: 800, reorder_level: 300, unit: 'pieces' },
      { material_id: 4, material_name: 'Paint Can', quantity_available: 18, reorder_level: 20, unit: 'cans' },
      { material_id: 5, material_name: 'Varnish', quantity_available: 35, reorder_level: 15, unit: 'litres' },
    ],
    orders: [
      { order_id: 1, product_name: 'Wooden Chair', quantity: 50, arrival_time: 0, execution_time: 6, priority: 2, deadline: 20, required_machine_type: 'CNC Machine', status: 'READY', created_at: now() },
      { order_id: 2, product_name: 'Dining Table', quantity: 20, arrival_time: 2, execution_time: 8, priority: 1, deadline: 25, required_machine_type: 'Assembly', status: 'READY', created_at: now() },
      { order_id: 3, product_name: 'Office Desk', quantity: 30, arrival_time: 4, execution_time: 7, priority: 3, deadline: 30, required_machine_type: 'CNC Machine', status: 'READY', created_at: now() },
      { order_id: 4, product_name: 'Storage Cabinet', quantity: 15, arrival_time: 6, execution_time: 3, priority: 2, deadline: 18, required_machine_type: 'Assembly', status: 'READY', created_at: now() },
      { order_id: 5, product_name: 'Bookshelf', quantity: 25, arrival_time: 8, execution_time: 4, priority: 4, deadline: 28, required_machine_type: 'Paint Booth', status: 'READY', created_at: now() },
      { order_id: 6, product_name: 'Metal Rack', quantity: 40, arrival_time: 10, execution_time: 5, priority: 1, deadline: 22, required_machine_type: 'Welding', status: 'READY', created_at: now() },
    ],
    pools: [
      { pool_id: 1, pool_name: 'CNC Units', total_units: 11, available_units: 3 },
      { pool_id: 2, pool_name: 'Worker Units', total_units: 6, available_units: 3 },
      { pool_id: 3, pool_name: 'Robot Units', total_units: 7, available_units: 2 },
    ],
    // [order_id, pool_id, allocated, max]
    claims: [
      [1,1,0,7],[1,2,1,5],[1,3,0,3],
      [2,1,2,3],[2,2,0,2],[2,3,0,2],
      [3,1,3,9],[3,2,0,0],[3,3,2,2],
      [4,1,2,2],[4,2,1,2],[4,3,1,2],
      [5,1,0,4],[5,2,0,3],[5,3,2,3],
      [6,1,1,3],[6,2,1,2],[6,3,0,1],
    ].map(([order_id, pool_id, allocated_units, max_units]) => ({ order_id, pool_id, allocated_units, max_units })),
    maintenance: [
      { maintenance_id: 1, machine_id: 4, description: 'Spray nozzle replacement', maintenance_date: '2026-10-28', completed: false },
      { maintenance_id: 2, machine_id: 1, description: 'Spindle calibration', maintenance_date: '2026-10-20', completed: true },
    ],
    scheduleRuns: [],   // { run_id, algorithm, quantum, metrics..., created_at, entries:[] }
    auditLog: [],       // { log_id, entity, entity_id, action, details, created_at }
    seq: { order: 6, run: 0, log: 0 },
  };
}

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = { freshData, now };
