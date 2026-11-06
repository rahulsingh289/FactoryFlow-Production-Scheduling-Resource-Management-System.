import { useState } from 'react';
import { api, isManager } from '../lib/api';
import useLive from '../lib/useLive';
import { Card, Tile, StatusBadge, Empty, Icon } from '../components/ui';

const STATUSES = ['AVAILABLE', 'OFF_SHIFT'];
const EMPTY = { full_name: '', skill: '', machine_type: '' };

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [machineTypes, setMachineTypes] = useState([]);
  const canEdit = isManager();
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState('');

  async function load(quiet) {
    try {
      const [w, m] = await Promise.all([api.get('/api/workers'), api.get('/api/machines')]);
      setWorkers(w);
      setMachineTypes([...new Set(m.map((x) => x.machine_type))]);
    } catch (e) { if (!quiet) setErr(e.message); }
  }
  useLive(load);

  async function add(e) {
    e.preventDefault(); setErr('');
    try {
      await api.post('/api/workers', form);
      setForm(EMPTY); setShowForm(false); load();
    } catch (e) { setErr(e.message); }
  }
  async function setStatus(id, status) {
    setErr('');
    try { await api.patch(`/api/workers/${id}/status`, { status }); } catch (e) { setErr(e.message); }
    load();
  }
  async function setTrained(id, machine_type) {
    setErr('');
    try { await api.patch(`/api/workers/${id}`, { machine_type }); } catch (e) { setErr(e.message); }
    load();
  }
  async function remove(w) {
    if (!confirm(`Delete ${w.full_name}?`)) return;
    setErr('');
    try { await api.del(`/api/workers/${w.worker_id}`); } catch (e) { setErr(e.message); }
    load();
  }

  const count = (status) => workers.filter((w) => w.status === status).length;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="stack">
      <div className="metric-row">
        <Tile icon="users" value={workers.length} label="Workers" />
        <Tile icon="check" tone="green" value={count('AVAILABLE')} label="Available" />
        <Tile icon="activity" value={count('ASSIGNED')} label="On an order" />
        <Tile icon="clock" tone="amber" value={count('OFF_SHIFT')} label="Off shift" />
      </div>

      <Card title="All workers" desc="Each order running needs one worker who is trained for its machine type"
        actions={canEdit && <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}><Icon name={showForm ? 'x' : 'plus'} size={16} />{showForm ? 'Cancel' : 'Add worker'}</button>}
        pad={false}>
        {err && <div className="form-error" style={{ margin: '18px 18px 0' }}><Icon name="alert" size={16} />{err}</div>}
        {canEdit && showForm && (
          <form className="form-grid" style={{ margin: 18, marginBottom: 0 }} onSubmit={add}>
            <label>Full name<input value={form.full_name} onChange={set('full_name')} required /></label>
            <label>Skill<input value={form.skill} onChange={set('skill')} placeholder="e.g. CNC Operator" required /></label>
            <label>Trained on
              <select value={form.machine_type} onChange={set('machine_type')}>
                <option value="">Any machine</option>
                {machineTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <button className="btn btn-primary"><Icon name="check" size={15} />Add</button>
          </form>
        )}
        {workers.length === 0 ? <div style={{ padding: 18 }}><Empty icon="users">No workers yet.</Empty></div> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Name</th><th>Skill</th><th>Trained on</th><th>Working on</th><th>Status</th><th></th></tr></thead>
            <tbody>{workers.map((w) => (
              <tr key={w.worker_id}>
                <td><b>{w.full_name}</b></td>
                <td className="muted">{w.skill}</td>
                <td>{canEdit && w.status !== 'ASSIGNED' ? (
                  <select className="status-select" value={w.machine_type || ''} onChange={(e) => setTrained(w.worker_id, e.target.value)}>
                    <option value="">Any machine</option>
                    {[...new Set([...machineTypes, ...(w.machine_type ? [w.machine_type] : [])])].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : <span className="muted">{w.machine_type || 'Any machine'}</span>}</td>
                <td className="muted">{w.current_order || '—'}</td>
                <td>{w.status === 'ASSIGNED' || !canEdit ? <StatusBadge status={w.status} /> : (
                  <select className="status-select" value={w.status} onChange={(e) => setStatus(w.worker_id, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}</td>
                <td>{canEdit && <button className="btn btn-ghost btn-sm btn-danger" title={`Delete ${w.full_name}`} onClick={() => remove(w)}><Icon name="trash" size={15} /></button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
