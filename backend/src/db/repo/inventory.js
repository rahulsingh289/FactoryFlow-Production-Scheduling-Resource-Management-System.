// Raw materials and their stock ledger.
const { memData, isMysql, q, httpError } = require('./shared');

async function listInventory() {
  if (isMysql()) { const [rows] = await q('SELECT * FROM inventory ORDER BY material_id'); return rows; }
  return [...memData().inventory];
}
const NO_MATERIAL = 'Material not found.';

async function updateInventoryQty(id, quantity) {
  if (isMysql()) {
    const [r] = await q('UPDATE inventory SET quantity_available = ? WHERE material_id = ?', [quantity, id]);
    if (!r.affectedRows) throw httpError(404, NO_MATERIAL);
    return;
  }
  const it = memData().inventory.find((x) => x.material_id === id);
  if (!it) throw httpError(404, NO_MATERIAL);
  it.quantity_available = quantity;
}

// A material an unfinished order still has to use can't be deleted. Orders that
// are finished, or already took their stock, don't need it any more.
const STILL_NEEDED = 'An order still needs this material. Remove it from the order first.';

async function deleteInventoryItem(id) {
  if (isMysql()) {
    const [[{ n }]] = await q(
      `SELECT COUNT(*) AS n FROM order_materials om JOIN production_orders o ON o.order_id = om.order_id
       WHERE om.material_id = ? AND o.status <> 'COMPLETED' AND NOT o.materials_taken`, [id]
    );
    if (n > 0) throw httpError(409, STILL_NEEDED);
    const [r] = await q('DELETE FROM inventory WHERE material_id = ?', [id]);
    if (!r.affectedRows) throw httpError(404, NO_MATERIAL);
    return;
  }
  const d = memData();
  if (!d.inventory.some((x) => x.material_id === id)) throw httpError(404, NO_MATERIAL);
  const needed = d.orderMaterials.some((m) => m.material_id === id
    && d.orders.some((o) => o.order_id === m.order_id && o.status !== 'COMPLETED' && !o.materials_taken));
  if (needed) throw httpError(409, STILL_NEEDED);
  d.inventory = d.inventory.filter((x) => x.material_id !== id);
  d.orderMaterials = d.orderMaterials.filter((m) => m.material_id !== id);
}
async function addInventoryItem({ material_name, quantity_available = 0, reorder_level = 0, unit = 'units' }) {
  if (isMysql()) {
    const [r] = await q('INSERT INTO inventory (material_name, quantity_available, reorder_level, unit) VALUES (?,?,?,?)',
      [material_name, quantity_available, reorder_level, unit]);
    return { material_id: r.insertId, material_name, quantity_available, reorder_level, unit };
  }
  const d = memData();
  const it = { material_id: ++d.seq.material, material_name, quantity_available, reorder_level, unit };
  d.inventory.push(it); return it;
}

// ------------------------------ Stock ledger -------------------------------
// Rows are written by a database trigger, so there is nothing to show without MySQL.
async function listInventoryLedger(limit = 15) {
  if (!isMysql()) return [];
  const [rows] = await q(
    `SELECT t.txn_id, i.material_name, i.unit, t.delta, t.balance_after, t.reason, t.created_at
     FROM inventory_transactions t JOIN inventory i ON i.material_id = t.material_id
     ORDER BY t.txn_id DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

module.exports = { listInventory, updateInventoryQty, addInventoryItem, deleteInventoryItem, listInventoryLedger };
