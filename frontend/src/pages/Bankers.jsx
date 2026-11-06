import React, { useState } from 'react';
import { api, isManager } from '../lib/api';
import useLive from '../lib/useLive';
import { Card, Empty, Icon, orderTag } from '../components/ui';

const shortName = (pool) => pool.pool_name.replace(/ slots$/i, '');

const OUTCOMES = {
  SAFE: [true, 'Safe to grant'],
  UNSAFE: [false, 'Not safe to grant'],
  WOULD_WAIT: [false, 'Would have to wait'],
  GRANTED: [true, 'Granted'],
  FORCED: [true, 'Granted without the safety check'],
  WAITING: [false, 'Order is waiting'],
  REFUSED: [false, 'Refused'],
};

const label = (o) => `${orderTag(o.order_id)} ${o.product_name}`;

export default function Bankers() {
  const [data, setData] = useState(null);
  const [deadlock, setDeadlock] = useState(null);
  const [err, setErr] = useState('');
  const [outcome, setOutcome] = useState(null);
  const [reqOrder, setReqOrder] = useState('');
  const [reqPool, setReqPool] = useState(0);
  const [reqUnits, setReqUnits] = useState(1);
  const canEdit = isManager();   // view-only accounts can look and test a request, not change anything
  const [details, setDetails] = useState(false);   // show Maximum, Check only and Force
  const [editing, setEditing] = useState(null);   // order id whose Maximum is being edited
  const [draft, setDraft] = useState([]);

  async function load(quiet) {
    try {
      const b = await api.get('/api/os/safety');   // safe-state check and deadlock detection in one call
      setData(b); setDeadlock(b.deadlock);
      setReqOrder((cur) => (b.orders.some((o) => String(o.order_id) === cur) ? cur : String(b.orders[0]?.order_id ?? '')));
      setReqPool((cur) => (cur < b.pools.length ? cur : 0));
    } catch (e) { if (!quiet) setErr(e.message); }
  }
  useLive(load);

  async function send(action, orderId = +reqOrder, units) {
    setErr(''); setOutcome(null);
    try {
      const list = units || data.pools.map((_, i) => (i === +reqPool ? Number(reqUnits) || 0 : 0));
      setOutcome(await api.post('/api/os/bankers/request', { order_id: orderId, units: list, action }));
      if (action !== 'check') load();
    } catch (e) { setErr(e.message); }
  }
  async function release(o) {
    if (!confirm(`Take back everything #${o.order_id} holds? A running order goes back to READY.`)) return;
    setErr(''); setOutcome(null);
    try { await api.post('/api/os/bankers/release', { order_id: o.order_id }); load(); } catch (e) { setErr(e.message); }
  }
  function startEdit(o) { setEditing(o.order_id); setDraft(o.max.map(String)); setErr(''); }
  async function saveMax(o) {
    setErr(''); setOutcome(null);
    try {
      for (let i = 0; i < data.pools.length; i++) {
        if (Number(draft[i]) !== o.max[i]) {
          await api.patch('/api/os/bankers/claims', { order_id: o.order_id, pool_id: data.pools[i].pool_id, max_units: Number(draft[i]) });
        }
      }
      setEditing(null); load();
    } catch (e) { setErr(e.message); }
  }

  if (err && !data) return <div className="form-error"><Icon name="alert" size={16} />{err}</div>;
  if (!data) return <p className="muted">Loading…</p>;

  const pools = data.pools;
  const byId = Object.fromEntries(data.orders.map((o) => [o.order_id, o]));
  const blocked = (deadlock?.blocked || []).map((id) => byId[id]).filter(Boolean);
  const anyWaiting = data.orders.some((o) => o.request.some(Boolean));

  // When the state is unsafe: what is free once every order that can finish has
  // finished, and which orders would still be short of what.
  const finishing = data.orders.filter((o) => data.sequence.includes(o.order_id));
  const work = pools.map((p, j) => finishing.reduce((sum, o) => sum + o.alloc[j], p.available_units));
  const stuck = data.safe ? [] : data.orders.filter((o) => !data.sequence.includes(o.order_id));
  const shortOf = (o) => pools.filter((_, j) => o.need[j] > work[j]).map(shortName).join(', ');

  // "1 CNC Machine, 2 Workers" or a dash when everything is zero.
  const show = (arr) => {
    const parts = arr.map((v, i) => (v > 0 ? `${v} ${shortName(pools[i])}` : null)).filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  };

  const sel = byId[+reqOrder];
  const pool = pools[+reqPool];
  const units = Number(reqUnits) || 0;
  let hint = '';
  if (sel && pool) {
    const need = sel.need[reqPool], free = pool.available_units;
    if (units > need) hint = `${orderTag(sel.order_id)} only needs ${need} more of this, so the request will be refused.`;
    else if (units > free) hint = `Only ${free} free, so the order would have to wait.`;
    else hint = `${orderTag(sel.order_id)} can ask for up to ${need} more. ${free} free.`;
  }

  const freeLine = pools.map((p) => `${shortName(p)} ${p.available_units} of ${p.total_units}`).join('  ·  ');
  const showActions = details && canEdit;
  const cols = 4 + (details ? 1 : 0) + (showActions ? 1 : 0);

  return (
    <div className="stack">
      {err && <div className="form-error"><Icon name="alert" size={16} />{err}</div>}

      <Card title="Status" desc="Is it safe to keep giving out machines and workers?"
        actions={<label className="check-toggle"><input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} />Show details</label>}>
        <div className="status-line">
          <span className={`status-dot ${data.safe ? 'ok' : 'bad'}`} />
          <div>
            <b>{data.safe ? 'Safe' : 'Unsafe'}</b>
            <span className="muted"> — {data.safe ? 'every order can still finish.' : 'some orders may never get what they need.'}</span>
            {data.safe && data.sequenceNames.length > 0 && details && (
              <div className="muted small">Safe order: {data.sequenceNames.map((s) => orderTag(s.order_id)).join(' → ')}</div>
            )}
            {stuck.length > 0 && (
              <ul className="plain-list">{stuck.map((o) => <li key={o.order_id}>{label(o)} is short of {shortOf(o)}</li>)}</ul>
            )}
          </div>
        </div>

        <div className="status-line">
          <span className={`status-dot ${deadlock?.deadlocked ? 'bad' : 'ok'}`} />
          <div>
            <b>{deadlock?.deadlocked ? 'Deadlock' : 'No deadlock'}</b>
            <span className="muted"> — {deadlock?.deadlocked ? 'these orders are waiting on each other:' : anyWaiting ? 'waiting orders will get their turn.' : 'nothing is waiting.'}</span>
            {deadlock?.deadlocked && (
              <ul className="plain-list">
                {blocked.map((o) => <li key={o.order_id}>{label(o)} {canEdit && <button className="row-action" onClick={() => release(o)}>Release to fix</button>}</li>)}
              </ul>
            )}
          </div>
        </div>

        {pools.length > 0 && <p className="muted small status-free">Free now: {freeLine}</p>}
      </Card>

      <Card title="Orders" desc="What each order holds, and what it can still ask for" pad={false}>
        {data.orders.length === 0 ? <div style={{ padding: 18 }}><Empty icon="orders">No active orders.</Empty></div> : (
          <div className="table-wrap"><table className="table units-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Allocation<small>holds now</small></th>
                {details && <th>Maximum<small>most it may ask for</small></th>}
                <th>Need<small>can still ask for</small></th>
                <th>Request<small>waiting for</small></th>
                {showActions && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <React.Fragment key={o.order_id}>
                  <tr>
                    <td><b>{label(o)}</b><div className="muted small">{o.status}</div></td>
                    <td>{show(o.alloc)}</td>
                    {details && <td>{show(o.max)}</td>}
                    <td>{show(o.need)}</td>
                    <td>{show(o.request)}</td>
                    {showActions && (
                      <td className="nowrap">
                        <button className="row-action" onClick={() => (editing === o.order_id ? setEditing(null) : startEdit(o))}>{editing === o.order_id ? 'Cancel' : 'Edit maximum'}</button>
                        {o.request.some(Boolean) && <button className="row-action" onClick={() => send('grant', o.order_id, o.request)}>Retry</button>}
                        {o.alloc.some(Boolean) && <button className="row-action" onClick={() => release(o)}>Release</button>}
                      </td>
                    )}
                  </tr>
                  {showActions && editing === o.order_id && (
                    <tr className="edit-row">
                      <td colSpan={cols}>
                        <div className="edit-box">
                          {pools.map((p, i) => (
                            <label key={p.pool_id}>{shortName(p)}
                              <input type="number" min={o.alloc[i]} max={p.total_units} value={draft[i] ?? ''}
                                onChange={(e) => { const d = [...draft]; d[i] = e.target.value; setDraft(d); }} />
                            </label>
                          ))}
                          <button className="btn btn-primary btn-sm" onClick={() => saveMax(o)}>Save</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>

      <Card title="Request a resource" desc="Give an order a machine slot or a worker. If it isn't safe, the order waits.">
        {data.orders.length === 0 || pools.length === 0 ? <Empty icon="safety">Add an order, a machine and a worker to try this.</Empty> : (
          <>
            <div className="ask-form">
              <label>Order
                <select value={reqOrder} onChange={(e) => { setReqOrder(e.target.value); setOutcome(null); }}>
                  {data.orders.map((o) => <option key={o.order_id} value={o.order_id}>{label(o)}</option>)}
                </select>
              </label>
              <label>Resource
                <select value={reqPool} onChange={(e) => { setReqPool(+e.target.value); setOutcome(null); }}>
                  {pools.map((p, i) => <option key={p.pool_id} value={i}>{p.pool_name}</option>)}
                </select>
              </label>
              <label>Units
                <input type="number" min="1" value={reqUnits} onChange={(e) => setReqUnits(e.target.value)} />
              </label>
              {canEdit && <button className="btn btn-primary" onClick={() => send('grant')} disabled={units < 1}>Request</button>}
              {(details || !canEdit) && <button className={canEdit ? 'btn' : 'btn btn-primary'} onClick={() => send('check')} disabled={units < 1}>Check only</button>}
              {details && canEdit && <button className="btn btn-danger" onClick={() => send('force')} disabled={units < 1}>Force</button>}
            </div>
            <p className="muted small">{hint}</p>
            {!canEdit && <p className="muted small">Your account is view-only, so you can test a request but not grant it.</p>}
            {details && canEdit && <p className="muted small">Check only tests the request without changing anything. Force grants it even when unsafe, which can cause a deadlock.</p>}
            {outcome && (
              <div className={`note ${(outcome.safe ?? OUTCOMES[outcome.outcome][0]) ? 'ok' : 'bad'}`}>
                <b>{OUTCOMES[outcome.outcome][1]}</b>
                <p>
                  {outcome.message}
                  {outcome.sequenceNames?.length > 0 && <> Safe order: {outcome.sequenceNames.map((s) => orderTag(s.order_id)).join(' → ')}</>}
                </p>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
