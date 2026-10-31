import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Card, Empty, Icon } from '../components/ui';

const ACTION_ICON = { INSERT: 'plus', STATUS_CHANGE: 'refresh', DELETE: 'trash' };

export default function Reports() {
  const [runs, setRuns] = useState([]);
  const [audit, setAudit] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [r, a] = await Promise.all([
          api.get('/api/reports/schedule-runs?limit=25'),
          api.get('/api/reports/audit?limit=40'),
        ]);
        setRuns(r); setAudit(a);
      } catch (e) { setErr(e.message); }
    })();
  }, []);

  if (err) return <div className="form-error"><Icon name="alert" size={16} />{err}</div>;

  const fmt = (t) => { try { return new Date(t).toLocaleString(); } catch { return t; } };

  return (
    <div className="stack">
      <Card title="Scheduling run history" desc="Every execution of the C++ engine, stored in MySQL" pad={false}>
        {runs.length === 0 ? <div style={{ padding: 20 }}><Empty icon="scheduler">No runs recorded yet — run the Scheduler.</Empty></div> : (
          <div className="table-wrap"><table className="table">
            <thead><tr>
              <th>Run</th><th>Algorithm</th><th className="num">Orders</th><th className="num">Avg wait</th>
              <th className="num">Avg turnaround</th><th className="num">Makespan</th><th className="num">Missed</th><th>When</th>
            </tr></thead>
            <tbody>{runs.map((r) => (
              <tr key={r.run_id}>
                <td className="num muted">#{r.run_id}</td>
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

      <Card title="Audit log" desc="Activity recorded automatically by database triggers">
        {audit.length === 0 ? <Empty icon="activity">No activity recorded.</Empty> : (
          <ul className="activity">
            {audit.map((a, i) => (
              <li key={i}>
                <div className="activity-ic"><Icon name={ACTION_ICON[a.action] || 'activity'} size={15} /></div>
                <div className="activity-txt"><b>{a.action.replace('_', ' ')}</b><span>{a.details}</span></div>
                <span className="muted small nowrap">{fmt(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
