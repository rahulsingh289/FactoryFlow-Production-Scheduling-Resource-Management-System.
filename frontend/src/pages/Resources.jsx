import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Card, StatusBadge, Gauge, Icon } from '../components/ui';

const MACHINE_STATUSES = ['AVAILABLE', 'BUSY', 'MAINTENANCE'];
const POOL_COLORS = ['var(--primary)', 'var(--cyan)', 'var(--amber)'];

export default function Resources() {
  const [m, setM] = useState([]); const [w, setW] = useState([]);
  const [inv, setInv] = useState([]); const [pools, setPools] = useState([]);
  const [err, setErr] = useState('');

  async function load() {
    try {
      const [mm, ww, ii, pp] = await Promise.all([
        api.get('/api/machines'), api.get('/api/workers'), api.get('/api/inventory'), api.get('/api/pools'),
      ]);
      setM(mm); setW(ww); setInv(ii); setPools(pp);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  const setMachine = async (id, status) => { try { await api.patch(`/api/machines/${id}/status`, { status }); load(); } catch (e) { setErr(e.message); } };
  const saveInv = async (id, value) => { try { await api.patch(`/api/inventory/${id}`, { quantity_available: +value }); load(); } catch (e) { setErr(e.message); } };

  return (
    <div className="stack">
      {err && <div className="form-error"><Icon name="alert" size={16} />{err}</div>}

      <Card title="Resource pools" desc="Abstract resource types used by the Banker's Algorithm">
        <div className="gauges">
          {pools.map((p, i) => (
            <Gauge key={p.pool_id} label={`${p.pool_name} · ${p.available_units} free`} value={p.total_units - p.available_units} total={p.total_units} color={POOL_COLORS[i % 3]} />
          ))}
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Machines" desc={`${m.length} machines on the floor`} pad={false}>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Name</th><th>Type</th><th className="num">Capacity</th><th>Status</th></tr></thead>
            <tbody>{m.map((x) => (
              <tr key={x.machine_id}><td><b>{x.machine_name}</b></td><td className="muted">{x.machine_type}</td><td className="num">{x.capacity}</td>
                <td><select className="status-select" value={x.status} onChange={(e) => setMachine(x.machine_id, e.target.value)}>
                  {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></td></tr>
            ))}</tbody>
          </table></div>
        </Card>

        <Card title="Workers" desc={`${w.length} operators`} pad={false}>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Name</th><th>Skill</th><th>Status</th></tr></thead>
            <tbody>{w.map((x) => (
              <tr key={x.worker_id}><td><b>{x.full_name}</b></td><td className="muted">{x.skill}</td><td><StatusBadge status={x.status} /></td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      </div>

      <Card title="Inventory" desc="Raw materials — edit a quantity and click away to save" pad={false}>
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
      </Card>
    </div>
  );
}
