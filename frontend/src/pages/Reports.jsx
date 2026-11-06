import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Card, Gauge, StatusBadge, Empty, Icon, runTag } from '../components/ui';

const TABS = [['performance', 'Performance'], ['history', 'History']];
const fmt = (t) => { try { return new Date(t).toLocaleString(); } catch { return t; } };

function Performance({ analytics }) {
  const { benchmark, machines, workers, pressure } = analytics;
  return (
    <>
      <div className="grid-2">
        <Card title="Algorithm benchmark" desc="Average results across every recorded run, lowest wait first" pad={false}>
          {benchmark.length === 0 ? <div style={{ padding: 18 }}><Empty icon="scheduler">Run the Scheduler to start comparing.</Empty></div> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Algorithm</th><th className="num">Runs</th><th className="num">Wait</th><th className="num">Turnaround</th><th className="num">Makespan</th></tr></thead>
              <tbody>{benchmark.map((b, i) => (
                <tr key={b.algorithm}>
                  <td><code>{b.algorithm}</code>{i === 0 && benchmark.length > 1 && <span className="best-badge">best</span>}</td>
                  <td className="num">{b.runs}</td>
                  <td className="num">{Number(b.mean_waiting).toFixed(2)}</td>
                  <td className="num">{Number(b.mean_turnaround).toFixed(2)}</td>
                  <td className="num">{Number(b.mean_makespan).toFixed(1)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>

        <Card title="Resource pressure" desc="What active orders still need, against the size of each pool" pad={false}>
          {pressure.length === 0 ? <div style={{ padding: 18 }}><Empty icon="resources">No resource pools yet.</Empty></div> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Pool</th><th className="num">Total</th><th className="num">Held</th><th className="num">Still needed</th><th className="num">Pressure</th></tr></thead>
              <tbody>{pressure.map((p) => (
                <tr key={p.pool_id}>
                  <td><b>{p.pool_name}</b></td>
                  <td className="num">{p.total_units}</td>
                  <td className="num">{p.allocated}</td>
                  <td className="num">{p.total_need}</td>
                  <td className={`num ${Number(p.pressure_pct) > 100 ? 'danger' : ''}`}>{p.pressure_pct == null ? '—' : `${Number(p.pressure_pct).toFixed(0)}%`}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      </div>

      <Card title="Machine utilisation" desc="Slots in use on each machine right now">
        {machines.length === 0 ? <Empty icon="cpu">No machines yet.</Empty> : (
          <div className="gauges" style={{ marginTop: 0 }}>
            {machines.map((m) => <Gauge key={m.machine_id} label={m.machine_name} value={m.active_allocations} total={m.capacity} />)}
          </div>
        )}
      </Card>

      <Card title="Worker workload" desc="Orders each worker has been given, busiest first" pad={false}>
        {workers.length === 0 ? <div style={{ padding: 18 }}><Empty icon="users">No workers yet.</Empty></div> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Worker</th><th>Skill</th><th className="num">Orders so far</th><th className="num">On now</th><th>Status</th></tr></thead>
            <tbody>{workers.map((w) => (
              <tr key={w.worker_id}>
                <td><b>{w.full_name}</b></td>
                <td className="muted">{w.skill}</td>
                <td className="num">{w.orders_handled}</td>
                <td className="num">{w.orders_active}</td>
                <td><StatusBadge status={w.status} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}

function History({ runs, history }) {
  return (
    <>
      <Card title="Scheduling run history" desc="Every scheduler run, with its results" pad={false}>
        {runs.length === 0 ? <div style={{ padding: 20 }}><Empty icon="scheduler">No runs recorded yet. Run the Scheduler.</Empty></div> : (
          <div className="table-wrap"><table className="table">
            <thead><tr>
              <th className="num">Run</th><th>Algorithm</th><th className="num">Orders</th><th className="num">Avg wait</th>
              <th className="num">Avg turnaround</th><th className="num">Makespan</th><th className="num">Missed</th><th>When</th>
            </tr></thead>
            <tbody>{runs.map((r) => (
              <tr key={r.run_id}>
                <td className="num muted">{runTag(r.run_id)}</td>
                <td><code>{r.algorithm}</code>{r.quantum > 0 && r.algorithm === 'RR' ? <span className="muted small"> q={r.quantum}</span> : null}</td>
                <td className="num">{r.orders_scheduled}</td>
                <td className="num">{Number(r.avg_waiting).toFixed(2)}</td>
                <td className="num">{Number(r.avg_turnaround).toFixed(2)}</td>
                <td className="num">{r.makespan}</td>
                <td className={`num ${r.missed_deadlines > 0 ? 'danger' : ''}`}>{r.missed_deadlines}</td>
                <td className="muted small">{fmt(r.created_at)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <Card title="Order results by run" desc="The 30 latest results for individual orders" pad={false}>
        {history.length === 0 ? <div style={{ padding: 18 }}><Empty icon="orders">No results recorded yet.</Empty></div> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th className="num">Run</th><th>Algorithm</th><th>Order</th><th className="num">Start</th><th className="num">Finish</th><th className="num">Wait</th><th className="num">Turnaround</th><th className="num">Deadline</th></tr></thead>
            <tbody>{history.map((h) => (
              <tr key={h.entry_id} className={h.missed_deadline ? 'row-danger' : ''}>
                <td className="num muted">{runTag(h.run_id)}</td>
                <td><code>{h.algorithm}</code></td>
                <td><b>{h.product_name}</b></td>
                <td className="num">{h.start_time}</td>
                <td className="num">{h.completion_time}</td>
                <td className="num">{h.waiting_time}</td>
                <td className="num">{h.turnaround_time}</td>
                <td className={`num ${h.missed_deadline ? 'danger' : ''}`}>{h.deadline}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}

export default function Reports() {
  const [tab, setTab] = useState('performance');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [analytics, runs] = await Promise.all([
          api.get('/api/reports/analytics'),
          api.get('/api/reports/schedule-runs?limit=25'),
        ]);
        setData({ analytics, runs });
      } catch (e) { setErr(e.message); }
    })();
  }, []);

  if (err) return <div className="form-error"><Icon name="alert" size={16} />{err}</div>;
  if (!data) return <p className="muted">Loading…</p>;

  return (
    <div className="stack">
      <div><div className="seg">
        {TABS.map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div></div>
      {tab === 'performance' && <Performance analytics={data.analytics} />}
      {tab === 'history' && <History runs={data.runs} history={data.analytics.history} />}
    </div>
  );
}
