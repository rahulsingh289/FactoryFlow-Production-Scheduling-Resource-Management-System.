import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Card, Tile, Donut, StatusBadge, Empty, Icon } from '../components/ui';

const STATE_COLORS = { READY: '#3f6ea0', RUNNING: '#4a8a5a', BLOCKED: '#9a6f17', COMPLETED: '#8c8777' };
const ACTION_ICON = { INSERT: 'plus', STATUS_CHANGE: 'refresh', DELETE: 'trash' };

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [stats, inventory, audit, runs, machines] = await Promise.all([
          api.get('/api/reports/dashboard'),
          api.get('/api/inventory'),
          api.get('/api/reports/audit?limit=7'),
          api.get('/api/reports/schedule-runs?limit=5'),
          api.get('/api/machines'),
        ]);
        setD({ stats, inventory, audit, runs, machines });
      } catch (e) { setErr(e.message); }
    })();
  }, []);

  if (err) return <div className="form-error"><Icon name="alert" size={16} />{err}</div>;
  if (!d) return <p className="muted">Loading…</p>;

  const { stats, inventory, audit, runs, machines } = d;
  const lowStock = inventory.filter((m) => m.quantity_available <= m.reorder_level);
  const segments = Object.entries(stats.ordersByStatus)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ label: k, value: v, color: STATE_COLORS[k] || '#94a3b8' }));

  return (
    <div className="stack">
      <div className="metric-row">
        <Tile icon="orders" tone="indigo" value={stats.totalOrders} label="Production orders" sub={`${stats.ordersByStatus.READY || 0} ready in queue`} />
        <Tile icon="check" tone="green" value={stats.ordersByStatus.COMPLETED || 0} label="Completed" />
        <Tile icon="resources" tone="cyan" value={`${stats.machinesAvailable}/${stats.totalMachines}`} label="Machines available" sub={`${stats.machinesMaintenance} in maintenance`} />
        <Tile icon="warehouse" tone={stats.lowStock ? 'red' : 'green'} value={stats.lowStock} label="Low-stock materials" />
      </div>

      <div className="grid-2">
        <Card title="Order states" desc="Distribution across the production lifecycle">
          {segments.length ? <Donut segments={segments} centerLabel="orders" /> : <Empty>No orders yet.</Empty>}
        </Card>

        <Card title="Machine floor" desc="Current status of each machine">
          <div className="stack" style={{ gap: 10 }}>
            {machines.map((m) => (
              <div key={m.machine_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="tile-ic cyan" style={{ width: 34, height: 34 }}><Icon name="cpu" size={17} /></div>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: '.88rem' }}>{m.machine_name}</b>
                  <div className="muted small">{m.machine_type} · capacity {m.capacity}</div>
                </div>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Low-stock alerts" desc="Materials at or below reorder level">
          {lowStock.length === 0 ? <Empty icon="check">All materials above reorder level.</Empty> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Material</th><th className="num">Available</th><th className="num">Reorder at</th></tr></thead>
              <tbody>{lowStock.map((m) => (
                <tr key={m.material_id}><td>{m.material_name}</td>
                  <td className="num danger">{m.quantity_available} {m.unit}</td>
                  <td className="num">{m.reorder_level}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>

        <Card title="Recent scheduling runs" desc="Latest scheduler executions">
          {runs.length === 0 ? <Empty icon="scheduler">No runs yet — open the Scheduler.</Empty> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Algorithm</th><th className="num">Avg wait</th><th className="num">Makespan</th><th className="num">Missed</th></tr></thead>
              <tbody>{runs.map((r) => (
                <tr key={r.run_id}><td><code>{r.algorithm}</code></td>
                  <td className="num">{Number(r.avg_waiting).toFixed(2)}</td>
                  <td className="num">{r.makespan}</td>
                  <td className={`num ${r.missed_deadlines > 0 ? 'danger' : ''}`}>{r.missed_deadlines}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      </div>

      <Card title="Activity log" desc="Recent changes (recorded by database triggers)">
        {audit.length === 0 ? <Empty icon="activity">No activity recorded.</Empty> : (
          <ul className="activity">
            {audit.map((a, i) => (
              <li key={i}>
                <div className="activity-ic"><Icon name={ACTION_ICON[a.action] || 'activity'} size={15} /></div>
                <div className="activity-txt"><b>{a.action.replace('_', ' ')}</b><span>{a.details}</span></div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
