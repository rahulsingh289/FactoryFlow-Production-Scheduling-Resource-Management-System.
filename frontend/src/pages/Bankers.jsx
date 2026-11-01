import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Card, Gauge, Icon } from '../components/ui';

function Verdict({ ok, title, children }) {
  return (
    <div className={`verdict ${ok ? 'verdict-safe' : 'verdict-unsafe'}`}>
      <div className="verdict-ic"><Icon name={ok ? 'check' : 'x'} /></div>
      <div><b>{title}</b><span>{children}</span></div>
    </div>
  );
}

export default function Bankers() {
  const [data, setData] = useState(null);
  const [deadlock, setDeadlock] = useState(null);
  const [err, setErr] = useState('');
  const [reqOrder, setReqOrder] = useState('');
  const [reqUnits, setReqUnits] = useState([]);
  const [reqResult, setReqResult] = useState(null);

  async function load() {
    try {
      const [b, d] = await Promise.all([api.get('/api/os/bankers'), api.get('/api/os/deadlock')]);
      setData(b); setDeadlock(d);
      if (b.orders.length) { setReqOrder(String(b.orders[0].order_id)); setReqUnits(b.pools.map(() => 0)); }
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function simulate(e) {
    e.preventDefault(); setErr(''); setReqResult(null);
    try {
      setReqResult(await api.post('/api/os/bankers/request', { order_id: +reqOrder, units: reqUnits.map(Number) }));
    } catch (e) { setErr(e.message); }
  }

  if (err && !data) return <div className="form-error"><Icon name="alert" size={16} />{err}</div>;
  if (!data) return <p className="muted">Loading…</p>;

  const pools = data.pools;
  const nameById = Object.fromEntries(data.orders.map((o) => [o.order_id, o.product_name]));
  const short = (s) => s.replace(' Units', '');

  return (
    <div className="stack">
      <div className="grid-2">
        <Card title="System safety" desc="Banker's Algorithm over the current allocation state">
          <Verdict ok={data.safe} title={data.safe ? 'SAFE state' : 'UNSAFE state'}>
            {data.safe ? 'A safe execution sequence exists.' : 'No ordering lets every order finish.'}
          </Verdict>
          {data.safe && (
            <div className="seq">
              {data.sequenceNames.map((s, i) => (
                <React.Fragment key={s.order_id}>
                  <span className="seq-node"><span className="n">#{s.order_id}</span>{s.product_name}</span>
                  {i < data.sequenceNames.length - 1 && <Icon name="refresh" size={14} className="arrow" style={{ transform: 'rotate(0deg)' }} />}
                </React.Fragment>
              ))}
            </div>
          )}
          <div className="gauges">
            {pools.map((p, i) => (
              <Gauge key={p.pool_id} label={`${short(p.pool_name)} available`} value={p.available_units} total={Math.max(...pools.map((x) => x.available_units), p.available_units) || 1} color="var(--green)" />
            ))}
          </div>
        </Card>

        <Card title="Deadlock detection" desc="Can every order obtain its outstanding need and finish?">
          {deadlock && (
            <>
              <Verdict ok={!deadlock.deadlocked} title={deadlock.deadlocked ? 'DEADLOCK detected' : 'No deadlock'}>
                {deadlock.deadlocked ? 'Some orders cannot proceed.' : 'All orders can complete.'}
              </Verdict>
              {deadlock.deadlocked ? (
                <p className="small">Blocked: {deadlock.blocked.map((id) => <span className="seq-node" key={id} style={{ marginRight: 6 }}><span className="n">#{id}</span>{nameById[id]}</span>)}</p>
              ) : (
                <div className="seq">
                  {deadlock.safeOrder.map((id, i) => (
                    <React.Fragment key={id}>
                      <span className="seq-node"><span className="n">#{id}</span>{nameById[id]}</span>
                      {i < deadlock.safeOrder.length - 1 && <span className="arrow">→</span>}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <Card title="Allocation / Maximum / Need matrix" desc="Need = Maximum − Allocation">
        <div className="table-wrap">
          <table className="table matrix">
            <thead>
              <tr>
                <th rowSpan="2">Order</th>
                <th colSpan={pools.length} className="grp-a">Allocation</th>
                <th colSpan={pools.length} className="grp-a">Maximum</th>
                <th colSpan={pools.length} className="grp-a">Need</th>
              </tr>
              <tr>
                {['A', 'M', 'N'].flatMap((g) => pools.map((p, i) => (
                  <th key={g + p.pool_id} className={`sub ${i === 0 ? 'grp-a' : ''}`}>{short(p.pool_name)}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.order_id}>
                  <td className="nowrap"><b>#{o.order_id}</b> {o.product_name}</td>
                  {o.alloc.map((v, i) => <td key={'a' + i} className={`num ${i === 0 ? 'grp-a' : ''}`}>{v}</td>)}
                  {o.max.map((v, i) => <td key={'m' + i} className={`num ${i === 0 ? 'grp-a' : ''}`}>{v}</td>)}
                  {o.need.map((v, i) => <td key={'n' + i} className={`num need-cell ${i === 0 ? 'grp-a' : ''}`}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="legend" style={{ marginTop: 14 }}>
          {pools.map((p, i) => <span className="legend-item" key={p.pool_id}>Available {short(p.pool_name)}: <b className="num">&nbsp;{p.available_units}</b></span>)}
        </div>
      </Card>

      <Card title="Resource-request simulator" desc="Check whether granting a request keeps the system safe">
        <form className="form-grid" onSubmit={simulate} style={{ marginBottom: 14 }}>
          <label>Order
            <select value={reqOrder} onChange={(e) => setReqOrder(e.target.value)}>
              {data.orders.map((o) => <option key={o.order_id} value={o.order_id}>#{o.order_id} {o.product_name}</option>)}
            </select>
          </label>
          {pools.map((p, i) => (
            <label key={p.pool_id}>{short(p.pool_name)}
              <input type="number" min="0" value={reqUnits[i] ?? 0}
                onChange={(e) => { const u = [...reqUnits]; u[i] = e.target.value; setReqUnits(u); }} />
            </label>
          ))}
          <button className="btn btn-primary"><Icon name="safety" size={16} />Check request</button>
        </form>
        {err && data && <div className="form-error"><Icon name="alert" size={16} />{err}</div>}
        {reqResult && (
          <Verdict ok={reqResult.granted} title={reqResult.granted ? 'Request granted' : 'Request denied'}>
            {reqResult.message}
            {reqResult.granted && reqResult.sequenceNames?.length > 0 && <> · safe sequence {reqResult.sequenceNames.map((s) => `#${s.order_id}`).join(' → ')}</>}
          </Verdict>
        )}
      </Card>
    </div>
  );
}
