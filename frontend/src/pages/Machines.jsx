import { useState } from 'react';
import { api, isManager } from '../lib/api';
import useLive from '../lib/useLive';
import { Card, Tile, StatusBadge, Empty, Icon } from '../components/ui';

const STATUSES = ['AVAILABLE', 'MAINTENANCE'];
const EMPTY = { machine_name: '', machine_type: '', capacity: 1 };

export default function Machines() {
  const [machines, setMachines] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState('');
  const canEdit = isManager();

  async function load(quiet) {
    try {
      setMachines(await api.get('/api/machines'));
    } catch (e) { if (!quiet) setErr(e.message); }
  }
  useLive(load);

  async function add(e) {
    e.preventDefault(); setErr('');
    try {
      await api.post('/api/machines', { ...form, capacity: +form.capacity });
      setForm(EMPTY); setShowForm(false); load();
    } catch (e) { setErr(e.message); }
  }
  async function setStatus(id, status) {
    setErr('');
    try { await api.patch(`/api/machines/${id}/status`, { status }); } catch (e) { setErr(e.message); }
    load();
  }
  async function remove(m) {
    if (!confirm(`Delete ${m.machine_name}?`)) return;
    setErr('');
    try { await api.del(`/api/machines/${m.machine_id}`); } catch (e) { setErr(e.message); }
    load();
  }

  const usable = machines.filter((m) => m.status !== 'MAINTENANCE');
  const slots = usable.reduce((sum, m) => sum + m.capacity, 0);
  const inUse = usable.reduce((sum, m) => sum + m.in_use, 0);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="stack">
      <div className="metric-row">
        <Tile icon="cpu" value={machines.length} label="Machines" sub={`${machines.length - usable.length} in maintenance`} />
        <Tile icon="activity" value={`${inUse}/${slots}`} label="Slots in use" sub="Orders running right now" />
        <Tile icon="check" tone="green" value={slots - inUse} label="Slots free" />
      </div>

      {err && <div className="form-error"><Icon name="alert" size={16} />{err}</div>}

      <Card title="All machines" desc="Each order running needs one slot on a machine of its type"
        actions={canEdit && <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}><Icon name={showForm ? 'x' : 'plus'} size={16} />{showForm ? 'Cancel' : 'Add machine'}</button>}
        pad={false}>
        {canEdit && showForm && (
          <form className="form-grid" style={{ margin: 18, marginBottom: 0 }} onSubmit={add}>
            <label>Name<input value={form.machine_name} onChange={set('machine_name')} placeholder="e.g. CNC-03" required /></label>
            <label>Type<input value={form.machine_type} onChange={set('machine_type')} placeholder="e.g. CNC Machine" required /></label>
            <label>Capacity<input type="number" min="1" value={form.capacity} onChange={set('capacity')} /></label>
            <button className="btn btn-primary"><Icon name="check" size={15} />Add</button>
          </form>
        )}
        {machines.length === 0 ? <div style={{ padding: 18 }}><Empty icon="cpu">No machines yet.</Empty></div> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Name</th><th>Type</th><th className="num">In use</th><th>Running</th><th>Status</th><th></th></tr></thead>
            <tbody>{machines.map((m) => (
              <tr key={m.machine_id}>
                <td><b>{m.machine_name}</b></td>
                <td className="muted">{m.machine_type}</td>
                <td className="num">{m.in_use}/{m.capacity}</td>
                <td className="muted">{m.current_orders || '—'}</td>
                <td>{m.status === 'BUSY' || !canEdit ? <StatusBadge status={m.status} /> : (
                  <select className="status-select" value={m.status} onChange={(e) => setStatus(m.machine_id, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}</td>
                <td>{canEdit && <button className="btn btn-ghost btn-sm btn-danger" title={`Delete ${m.machine_name}`} onClick={() => remove(m)}><Icon name="trash" size={15} /></button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

    </div>
  );
}
