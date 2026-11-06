import { useState } from 'react';
import { api, ALGORITHMS, isManager } from '../lib/api';
import useLive from '../lib/useLive';
import { Card, Tile, StatusBadge, Empty, Icon, orderTag } from '../components/ui';

const EMPTY = { product_name: '', quantity: 10, arrival_time: 0, execution_time: 5, priority: 3, deadline: 20, required_machine_type: '' };

// The states an order can move to from each state.
const NEXT_STATES = {
  READY: ['RUNNING', 'BLOCKED'],
  RUNNING: ['READY', 'BLOCKED', 'COMPLETED'],
  BLOCKED: ['READY'],
  COMPLETED: [],
};
const STATE_TILES = [
  ['READY', 'clock', 'indigo', 'Queued for a machine and worker'],
  ['RUNNING', 'play', 'green', 'Holding a machine and worker'],
  ['BLOCKED', 'alert', 'amber', 'Out of the queue'],
  ['COMPLETED', 'check', 'indigo', 'Finished'],
];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [machineTypes, setMachineTypes] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [counts, setCounts] = useState({});               // orders in each state, whether or not they're listed
  const [showAll, setShowAll] = useState(false);          // also list every finished order, not just the newest
  const [rows, setRows] = useState([]);                 // materials chosen in the form
  const [editingId, setEditingId] = useState(null);     // the order being edited, if any
  const canEdit = isManager();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState('');
  const [algorithm, setAlgorithm] = useState('PRIORITY');
  const [dispatch, setDispatch] = useState(null);

  async function load(quiet, all = showAll) {
    try {
      const [o, m, inv, c] = await Promise.all([
        api.get(all ? '/api/orders?finished=all' : '/api/orders'),
        api.get('/api/machines'), api.get('/api/inventory'), api.get('/api/orders/counts'),
      ]);
      setOrders(o); setInventory(inv); setCounts(c);
      setMachineTypes([...new Set(m.map((x) => x.machine_type))]);
    } catch (e) { if (!quiet) setErr(e.message); }
  }
  useLive(load);

  const editing = orders.find((o) => o.order_id === editingId);
  const typeLocked = editing?.status === 'RUNNING';      // can't move a running order to another machine type
  const materialsLocked = Boolean(editing?.materials_taken);

  function closeForm() { setShowForm(false); setEditingId(null); setForm(EMPTY); setRows([]); setErr(''); }
  function startEdit(o) {
    setErr('');
    setForm({
      product_name: o.product_name, quantity: o.quantity, arrival_time: o.arrival_time, execution_time: o.execution_time,
      priority: o.priority, deadline: o.deadline, required_machine_type: o.required_machine_type || '',
    });
    setRows(o.materials.map((m) => ({ material_id: String(m.material_id), quantity: m.quantity })));
    setEditingId(o.order_id); setShowForm(true);
  }
  const setRow = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function saveOrder(e) {
    e.preventDefault(); setErr('');
    const body = {
      ...form, quantity: +form.quantity, arrival_time: +form.arrival_time,
      execution_time: +form.execution_time, priority: +form.priority, deadline: +form.deadline,
    };
    if (!materialsLocked) body.materials = rows.filter((r) => r.material_id).map((r) => ({ material_id: +r.material_id, quantity: +r.quantity }));
    try {
      if (editingId) await api.patch(`/api/orders/${editingId}`, body);
      else await api.post('/api/orders', body);
      closeForm(); load();
    } catch (e) { setErr(e.message); }
  }
  async function changeStatus(id, status) {
    setErr('');
    try { await api.patch(`/api/orders/${id}/status`, { status }); load(); } catch (e) { setErr(e.message); }
  }
  async function remove(id) {
    if (!confirm('Delete this order?')) return;
    try { await api.del(`/api/orders/${id}`); load(); } catch (e) { setErr(e.message); }
  }
  async function startReady() {
    setErr(''); setDispatch(null);
    try { setDispatch(await api.post('/api/os/dispatch', { algorithm })); load(); } catch (e) { setErr(e.message); }
  }

  const filtered = orders.filter((o) => o.product_name.toLowerCase().includes(search.toLowerCase()));
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const countIn = (state) => counts[state] ?? orders.filter((o) => o.status === state).length;
  const hiddenFinished = Math.max(0, (counts.COMPLETED ?? 0) - orders.filter((o) => o.status === 'COMPLETED').length);

  return (
    <div className="stack">
      <div className="metric-row">
        {STATE_TILES.map(([state, icon, tone, sub]) => <Tile key={state} icon={icon} tone={tone} value={countIn(state)} label={state} sub={sub} />)}
      </div>

      <Card title="Start ready orders" desc="Starts READY orders in the order the chosen policy would run them, until machines or workers run out.">
        <div className="scheduler-controls">
          <label style={{ minWidth: 240 }}>Policy
            <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
              {ALGORITHMS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={startReady} disabled={countIn('READY') === 0}><Icon name="play" size={16} />Start ready orders</button>
        </div>
        {dispatch && (
          <div className="dispatch-result">
            <b>{dispatch.started.length ? `Started ${dispatch.started.length} of ${dispatch.started.length + dispatch.waiting.length}` : 'Nothing could start'}</b>
            {dispatch.started.map((s) => <div key={s.pid}><span className="num muted">{orderTag(s.pid)}</span> {s.product_name}: {s.machine}, {s.worker}</div>)}
            {dispatch.waiting.map((w) => <div key={w.pid} className="muted"><span className="num">{orderTag(w.pid)}</span> {w.product_name}: {w.message}</div>)}
          </div>
        )}
      </Card>

      <Card
        title="Production orders"
        desc={`${Object.values(counts).reduce((a, b) => a + b, 0) || orders.length} orders · each behaves like an OS process (arrival, burst, priority, deadline)`}
        actions={
          <>
            <div className="search-box"><Icon name="search" /><input placeholder="Search product…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            {canEdit && (
              <button className="btn btn-primary" onClick={() => (showForm ? closeForm() : setShowForm(true))}>
                <Icon name={showForm ? 'x' : 'plus'} size={16} />{showForm ? 'Cancel' : 'New order'}
              </button>
            )}
          </>
        }
        pad={false}
      >
        <div style={{ padding: 20, paddingBottom: 0 }}>
          {err && <div className="form-error"><Icon name="alert" size={16} />{err}</div>}
          {canEdit && showForm && (
            <form className="form-grid" onSubmit={saveOrder}>
              {editing && <div className="form-note">Editing {orderTag(editing.order_id)} {editing.product_name}{typeLocked ? '. It is running, so its machine type can\'t change.' : ''}</div>}
              <label>Product<input value={form.product_name} onChange={set('product_name')} required placeholder="e.g. Office Chair" /></label>
              <label>Quantity<input type="number" min="1" max="1000000" value={form.quantity} onChange={set('quantity')} /></label>
              <label>Arrival time<input type="number" min="0" max="1000000" value={form.arrival_time} onChange={set('arrival_time')} /></label>
              <label>Execution (burst)<input type="number" min="1" max="100000" value={form.execution_time} onChange={set('execution_time')} /></label>
              <label>Priority (1 = high)
                <select value={form.priority} onChange={set('priority')}>{[1,2,3,4,5].map((p) => <option key={p} value={p}>{p}</option>)}</select>
              </label>
              <label>Deadline<input type="number" min="0" max="1000000" value={form.deadline} onChange={set('deadline')} /></label>
              <label>Machine type
                <select value={form.required_machine_type} onChange={set('required_machine_type')} disabled={typeLocked}>
                  <option value="">Any machine</option>
                  {machineTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <div className="materials-box">
                <div><b>Materials</b> <span className="muted small">taken out of stock when the order starts</span></div>
                {materialsLocked && <div className="muted small">Its materials have already been used, so they can't change.</div>}
                {!materialsLocked && inventory.length === 0 && <div className="muted small">Add materials on the Inventory page to use them here.</div>}
                {rows.map((r, i) => (
                  <div className="material-row" key={i}>
                    <select value={r.material_id} disabled={materialsLocked} onChange={(e) => setRow(i, { material_id: e.target.value })}>
                      <option value="">Choose a material</option>
                      {inventory.map((m) => <option key={m.material_id} value={m.material_id}>{m.material_name} ({m.quantity_available} {m.unit} in stock)</option>)}
                    </select>
                    <input type="number" min="1" value={r.quantity} disabled={materialsLocked} onChange={(e) => setRow(i, { quantity: e.target.value })} aria-label="Quantity" />
                    {!materialsLocked && <button type="button" className="btn btn-ghost btn-sm" title="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Icon name="x" size={15} /></button>}
                  </div>
                ))}
                {!materialsLocked && inventory.length > 0 && (
                  <div><button type="button" className="btn btn-sm" onClick={() => setRows([...rows, { material_id: '', quantity: 1 }])}><Icon name="plus" size={14} />Add material</button></div>
                )}
              </div>
              <button className="btn btn-primary"><Icon name="check" size={16} />{editingId ? 'Save changes' : 'Create'}</button>
            </form>
          )}
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th className="num">ID</th><th>Product</th><th className="num">Qty</th><th className="num">Arrival</th><th className="num">Burst</th>
              <th>Priority</th><th className="num">Deadline</th><th>Needs</th><th>Materials</th><th>Assigned</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.order_id}>
                  <td className="num muted">{orderTag(o.order_id)}</td>
                  <td><b>{o.product_name}</b></td>
                  <td className="num">{o.quantity}</td>
                  <td className="num">{o.arrival_time}</td>
                  <td className="num">{o.execution_time}</td>
                  <td><span className={`prio prio-${o.priority}`}>P{o.priority}</span></td>
                  <td className="num">{o.deadline}</td>
                  <td className="muted">{o.required_machine_type || 'Any machine'}</td>
                  <td className="muted">{o.materials.length ? o.materials.map((m) => `${m.quantity} ${m.material_name}`).join(', ') : '—'}{o.materials.length > 0 && o.materials_taken ? ' (used)' : ''}</td>
                  <td className="muted">{o.assigned_machine ? `${o.assigned_machine} · ${o.assigned_worker}` : '—'}</td>
                  <td>
                    {o.status === 'COMPLETED' ? <StatusBadge status={o.status} /> : (
                      <select className="status-select" value={o.status} onChange={(e) => changeStatus(o.order_id, e.target.value)}>
                        {[o.status, ...NEXT_STATES[o.status]].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="nowrap">
                    {canEdit && o.status !== 'COMPLETED' && <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => startEdit(o)}><Icon name="edit" size={15} /></button>}
                    {canEdit && <button className="btn btn-ghost btn-sm btn-danger" title="Delete" onClick={() => remove(o.order_id)}><Icon name="trash" size={15} /></button>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="12"><Empty icon="orders">No orders match your search.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
        {(hiddenFinished > 0 || showAll) && (
          <div className="table-foot muted small">
            {showAll ? 'Showing every finished order. ' : `${hiddenFinished} older finished orders are hidden. `}
            <button className="row-action" style={{ margin: 0 }} onClick={() => { setShowAll(!showAll); load(false, !showAll); }}>
              {showAll ? 'Show only the newest' : 'Show all'}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
