import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Card, StatusBadge, Gauge, Empty, Icon } from '../components/ui';

const MACHINE_STATUSES = ['AVAILABLE', 'BUSY', 'MAINTENANCE'];
const POOL_COLORS = ['var(--primary)', 'var(--cyan)', 'var(--amber)', 'var(--green)'];

function AddButton({ open, onClick, label }) {
  return <button className="btn btn-sm" onClick={onClick}><Icon name={open ? 'x' : 'plus'} size={14} />{open ? 'Cancel' : label}</button>;
}

export default function Resources() {
  const [m, setM] = useState([]); const [w, setW] = useState([]);
  const [inv, setInv] = useState([]); const [pools, setPools] = useState([]);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState({});
  const [mf, setMf] = useState({ machine_name: '', machine_type: '', capacity: 1 });
  const [wf, setWf] = useState({ full_name: '', skill: '' });
  const [inf, setInf] = useState({ material_name: '', quantity_available: 0, reorder_level: 0, unit: 'units' });
  const [pf, setPf] = useState({ pool_name: '', total_units: 1 });

  async function load() {
    try {
      const [mm, ww, ii, pp] = await Promise.all([
        api.get('/api/machines'), api.get('/api/workers'), api.get('/api/inventory'), api.get('/api/pools'),
      ]);
      setM(mm); setW(ww); setInv(ii); setPools(pp);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  const toggle = (k) => () => { setOpen((o) => ({ ...o, [k]: !o[k] })); setErr(''); };
  const setMachine = async (id, status) => { try { await api.patch(`/api/machines/${id}/status`, { status }); load(); } catch (e) { setErr(e.message); } };
  const saveInv = async (id, value) => { try { await api.patch(`/api/inventory/${id}`, { quantity_available: +value }); load(); } catch (e) { setErr(e.message); } };

  async function submit(e, path, body, resetFn, key) {
    e.preventDefault(); setErr('');
    try { await api.post(path, body); resetFn(); setOpen((o) => ({ ...o, [key]: false })); load(); }
    catch (e) { setErr(e.message); }
  }

  return (
    <div className="stack">
      {err && <div className="form-error"><Icon name="alert" size={16} />{err}</div>}

      <Card title="Resource pools" desc="Abstract resource types used by the Banker's Algorithm"
        actions={<AddButton open={open.pool} onClick={toggle('pool')} label="Add pool" />} pad={false}>
        <div style={{ padding: 18 }}>
          {open.pool && (
            <form className="form-grid" onSubmit={(e) => submit(e, '/api/pools', { ...pf, total_units: +pf.total_units }, () => setPf({ pool_name: '', total_units: 1 }), 'pool')}>
              <label>Pool name<input value={pf.pool_name} onChange={(e) => setPf({ ...pf, pool_name: e.target.value })} placeholder="e.g. CNC Units" required /></label>
              <label>Total units<input type="number" min="0" value={pf.total_units} onChange={(e) => setPf({ ...pf, total_units: e.target.value })} /></label>
              <button className="btn btn-primary"><Icon name="check" size={15} />Add</button>
            </form>
          )}
          {pools.length === 0 ? <Empty icon="resources">No resource pools yet. Add one to use the scheduler and Banker's Algorithm.</Empty> : (
            <div className="gauges">
              {pools.map((p, i) => (
                <Gauge key={p.pool_id} label={`${p.pool_name} · ${p.available_units} free`} value={p.total_units - p.available_units} total={p.total_units} color={POOL_COLORS[i % POOL_COLORS.length]} />
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Machines" desc={`${m.length} on the floor`}
          actions={<AddButton open={open.machine} onClick={toggle('machine')} label="Add machine" />} pad={false}>
          {open.machine && (
            <form className="form-grid" style={{ margin: 18, marginBottom: 0 }} onSubmit={(e) => submit(e, '/api/machines', { ...mf, capacity: +mf.capacity }, () => setMf({ machine_name: '', machine_type: '', capacity: 1 }), 'machine')}>
              <label>Name<input value={mf.machine_name} onChange={(e) => setMf({ ...mf, machine_name: e.target.value })} required /></label>
              <label>Type<input value={mf.machine_type} onChange={(e) => setMf({ ...mf, machine_type: e.target.value })} placeholder="e.g. CNC Machine" required /></label>
              <label>Capacity<input type="number" min="1" value={mf.capacity} onChange={(e) => setMf({ ...mf, capacity: e.target.value })} /></label>
              <button className="btn btn-primary"><Icon name="check" size={15} />Add</button>
            </form>
          )}
          {m.length === 0 ? <div style={{ padding: 18 }}><Empty icon="cpu">No machines yet.</Empty></div> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Name</th><th>Type</th><th className="num">Capacity</th><th>Status</th></tr></thead>
              <tbody>{m.map((x) => (
                <tr key={x.machine_id}><td><b>{x.machine_name}</b></td><td className="muted">{x.machine_type}</td><td className="num">{x.capacity}</td>
                  <td><select className="status-select" value={x.status} onChange={(e) => setMachine(x.machine_id, e.target.value)}>
                    {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>

        <Card title="Workers" desc={`${w.length} operators`}
          actions={<AddButton open={open.worker} onClick={toggle('worker')} label="Add worker" />} pad={false}>
          {open.worker && (
            <form className="form-grid" style={{ margin: 18, marginBottom: 0 }} onSubmit={(e) => submit(e, '/api/workers', wf, () => setWf({ full_name: '', skill: '' }), 'worker')}>
              <label>Full name<input value={wf.full_name} onChange={(e) => setWf({ ...wf, full_name: e.target.value })} required /></label>
              <label>Skill<input value={wf.skill} onChange={(e) => setWf({ ...wf, skill: e.target.value })} placeholder="e.g. CNC Operator" required /></label>
              <button className="btn btn-primary"><Icon name="check" size={15} />Add</button>
            </form>
          )}
          {w.length === 0 ? <div style={{ padding: 18 }}><Empty icon="users">No workers yet.</Empty></div> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Name</th><th>Skill</th><th>Status</th></tr></thead>
              <tbody>{w.map((x) => (
                <tr key={x.worker_id}><td><b>{x.full_name}</b></td><td className="muted">{x.skill}</td><td><StatusBadge status={x.status} /></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      </div>

      <Card title="Inventory" desc="Raw materials — edit a quantity and click away to save"
        actions={<AddButton open={open.inventory} onClick={toggle('inventory')} label="Add material" />} pad={false}>
        {open.inventory && (
          <form className="form-grid" style={{ margin: 18, marginBottom: 0 }} onSubmit={(e) => submit(e, '/api/inventory', { ...inf, quantity_available: +inf.quantity_available, reorder_level: +inf.reorder_level }, () => setInf({ material_name: '', quantity_available: 0, reorder_level: 0, unit: 'units' }), 'inventory')}>
            <label>Material<input value={inf.material_name} onChange={(e) => setInf({ ...inf, material_name: e.target.value })} required /></label>
            <label>Quantity<input type="number" min="0" value={inf.quantity_available} onChange={(e) => setInf({ ...inf, quantity_available: e.target.value })} /></label>
            <label>Reorder at<input type="number" min="0" value={inf.reorder_level} onChange={(e) => setInf({ ...inf, reorder_level: e.target.value })} /></label>
            <label>Unit<input value={inf.unit} onChange={(e) => setInf({ ...inf, unit: e.target.value })} /></label>
            <button className="btn btn-primary"><Icon name="check" size={15} />Add</button>
          </form>
        )}
        {inv.length === 0 ? <div style={{ padding: 18 }}><Empty icon="warehouse">No materials yet.</Empty></div> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Material</th><th className="num">Available</th><th className="num">Reorder at</th><th>Status</th></tr></thead>
            <tbody>{inv.map((x) => {
              const low = x.quantity_available <= x.reorder_level;
              return (
                <tr key={x.material_id} className={low ? 'row-danger' : ''}>
                  <td><b>{x.material_name}</b></td>
                  <td className="num"><input className="inline-input" type="number" min="0" defaultValue={x.quantity_available}
                    onBlur={(e) => +e.target.value !== x.quantity_available && saveInv(x.material_id, e.target.value)} /> <span className="muted">{x.unit}</span></td>
                  <td className="num">{x.reorder_level}</td>
                  <td>{low ? <span className="badge badge-maintenance"><i className="dot" />Low stock</span> : <span className="badge badge-running"><i className="dot" />OK</span>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
