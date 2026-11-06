import { useState } from 'react';
import { api, isManager } from '../lib/api';
import useLive from '../lib/useLive';
import { Card, Gauge, Empty, Icon } from '../components/ui';

function AddButton({ open, onClick, label }) {
  return <button className="btn btn-sm" onClick={onClick}><Icon name={open ? 'x' : 'plus'} size={14} />{open ? 'Cancel' : label}</button>;
}

export default function Resources() {
  const [inv, setInv] = useState([]); const [pools, setPools] = useState([]); const [ledger, setLedger] = useState([]);
  const [err, setErr] = useState('');
  const canEdit = isManager();
  const [open, setOpen] = useState({});
  const [inf, setInf] = useState({ material_name: '', quantity_available: 0, unit: 'units' });
  const [pf, setPf] = useState({ pool_name: '', total_units: 1 });

  async function load(quiet) {
    try {
      const [ii, pp, ll] = await Promise.all([api.get('/api/inventory'), api.get('/api/pools'), api.get('/api/inventory/ledger')]);
      setInv(ii); setPools(pp); setLedger(ll);
    } catch (e) { if (!quiet) setErr(e.message); }
  }
  useLive(load);

  const toggle = (k) => () => { setOpen((o) => ({ ...o, [k]: !o[k] })); setErr(''); };
  // A failed save reloads too, so the box goes back to the real quantity.
  const saveInv = async (id, value) => {
    try { await api.patch(`/api/inventory/${id}`, { quantity_available: +value }); } catch (e) { setErr(e.message); }
    load();
  };
  const removeItem = async (item) => {
    if (!confirm(`Delete ${item.material_name} and its stock history?`)) return;
    try { await api.del(`/api/inventory/${item.material_id}`); } catch (e) { setErr(e.message); }
    load();
  };
  const removePool = async (pool) => {
    if (!confirm(`Delete the ${pool.pool_name} pool?`)) return;
    setErr('');
    try { await api.del(`/api/pools/${pool.pool_id}`); } catch (e) { setErr(e.message); }
    load();
  };

  async function submit(e, path, body, resetFn, key) {
    e.preventDefault(); setErr('');
    try { await api.post(path, body); resetFn(); setOpen((o) => ({ ...o, [key]: false })); load(); }
    catch (e) { setErr(e.message); }
  }

  return (
    <div className="stack">
      {err && <div className="form-error"><Icon name="alert" size={16} />{err}</div>}

      <Card title="Resource pools" desc="What the Banker's Algorithm shares out. Slots and workers follow the Machines and Workers pages; add a pool for anything else, like tooling."
        actions={canEdit && <AddButton open={open.pool} onClick={toggle('pool')} label="Add pool" />} pad={false}>
        <div style={{ padding: 18 }}>
          {canEdit && open.pool && (
            <form className="form-grid" onSubmit={(e) => submit(e, '/api/pools', { ...pf, total_units: +pf.total_units }, () => setPf({ pool_name: '', total_units: 1 }), 'pool')}>
              <label>Pool name<input value={pf.pool_name} onChange={(e) => setPf({ ...pf, pool_name: e.target.value })} placeholder="e.g. Tooling kits" required /></label>
              <label>Total units<input type="number" min="0" value={pf.total_units} onChange={(e) => setPf({ ...pf, total_units: e.target.value })} /></label>
              <button className="btn btn-primary"><Icon name="check" size={15} />Add</button>
            </form>
          )}
          {pools.length === 0 ? <Empty icon="resources">No resource pools yet. Add a machine or a worker to create the first ones.</Empty> : (
            <div className="gauges">
              {pools.map((p) => (
                <div className="gauge-wrap" key={p.pool_id}>
                  <Gauge label={`${p.pool_name} · ${p.available_units} free`} value={p.total_units - p.available_units} total={p.total_units} />
                  {canEdit && !p.auto_managed && <button className="gauge-remove" title={`Delete ${p.pool_name}`} onClick={() => removePool(p)}><Icon name="x" size={13} /></button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Inventory" desc={canEdit ? 'Raw materials. Edit a quantity and click away to save. Orders take their materials from here when they start.' : 'Raw materials. Orders take their materials from here when they start.'}
        actions={canEdit && <AddButton open={open.inventory} onClick={toggle('inventory')} label="Add material" />} pad={false}>
        {canEdit && open.inventory && (
          <form className="form-grid" style={{ margin: 18, marginBottom: 0 }} onSubmit={(e) => submit(e, '/api/inventory', { ...inf, quantity_available: +inf.quantity_available }, () => setInf({ material_name: '', quantity_available: 0, unit: 'units' }), 'inventory')}>
            <label>Material<input value={inf.material_name} onChange={(e) => setInf({ ...inf, material_name: e.target.value })} required /></label>
            <label>Quantity<input type="number" min="0" value={inf.quantity_available} onChange={(e) => setInf({ ...inf, quantity_available: e.target.value })} /></label>
            <label>Unit<input value={inf.unit} onChange={(e) => setInf({ ...inf, unit: e.target.value })} /></label>
            <button className="btn btn-primary"><Icon name="check" size={15} />Add</button>
          </form>
        )}
        {inv.length === 0 ? <div style={{ padding: 18 }}><Empty icon="warehouse">No materials yet.</Empty></div> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Material</th><th className="num">Available</th><th></th></tr></thead>
            <tbody>{inv.map((x) => (
                <tr key={x.material_id}>
                  <td><b>{x.material_name}</b></td>
                  <td className="num">{canEdit
                    ? <input key={x.quantity_available} className="inline-input" type="number" min="0" defaultValue={x.quantity_available}
                        onBlur={(e) => +e.target.value !== x.quantity_available && saveInv(x.material_id, e.target.value)} />
                    : x.quantity_available} <span className="muted">{x.unit}</span></td>
                  <td>{canEdit && <button className="btn btn-ghost btn-sm btn-danger" title={`Delete ${x.material_name}`} onClick={() => removeItem(x)}><Icon name="trash" size={15} /></button>}</td>
                </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <Card title="Stock ledger" desc="Every change to a quantity, written automatically by a database trigger" pad={false}>
        {ledger.length === 0 ? <div style={{ padding: 18 }}><Empty icon="warehouse">No stock changes yet.</Empty></div> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Material</th><th>Reason</th><th className="num">Change</th><th className="num">Balance</th><th>When</th></tr></thead>
            <tbody>{ledger.map((t) => (
              <tr key={t.txn_id}>
                <td><b>{t.material_name}</b></td>
                <td className="muted">{t.reason}</td>
                <td className={`num ${t.delta < 0 ? 'danger' : 'success'}`}>{t.delta > 0 ? '+' : ''}{t.delta}</td>
                <td className="num">{t.balance_after} <span className="muted">{t.unit}</span></td>
                <td className="muted small">{new Date(t.created_at).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
