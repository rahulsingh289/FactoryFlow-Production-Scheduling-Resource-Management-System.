import { useState } from 'react';
import { api } from '../lib/api';
import useLive from '../lib/useLive';
import { Card, Tile, Donut, StatusBadge, Empty, Icon } from '../components/ui';

const STATE_COLORS = { READY: '#3f6ea0', RUNNING: '#4a8a5a', BLOCKED: '#9a6f17', COMPLETED: '#8c8777' };

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  async function load(quiet) {
    try {
      // The dashboard numbers already include the machine and worker lists, and
      // the safety call covers the safe-state check and deadlock detection together.
      const [stats, runs, safety] = await Promise.all([
        api.get('/api/reports/dashboard'),
        api.get('/api/reports/schedule-runs?limit=5'),
        api.get('/api/os/safety').catch(() => null),
      ]);
      setD({ stats, runs, machines: stats.machines, workers: stats.workers, safety, deadlock: safety?.deadlock });
      setErr('');
    } catch (e) { if (!quiet) setErr(e.message); }
  }
  useLive(load);

  if (err) return <div className="form-error"><Icon name="alert" size={16} />{err}</div>;
  if (!d) return <p className="muted">Loading…</p>;

  const { stats, runs, machines, workers, safety, deadlock } = d;
  const segments = Object.entries(stats.ordersByStatus)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ label: k, value: v, color: STATE_COLORS[k] || '#94a3b8' }));

  return (
    <div className="stack">
      <div className="metric-row">
        <Tile icon="orders" tone="indigo" value={stats.totalOrders} label="Production orders" sub={`${stats.ordersByStatus.READY || 0} ready in queue`} />
        <Tile icon="check" tone="green" value={stats.ordersByStatus.COMPLETED || 0} label="Completed" />
        <Tile icon="resources" tone="cyan" value={`${stats.machinesAvailable}/${stats.totalMachines}`} label="Machines available" sub={`${stats.machinesMaintenance} in maintenance`} />
        <Tile icon="users" tone="cyan" value={`${stats.workersAvailable}/${stats.totalWorkers}`} label="Workers available" sub={`${stats.workersOffShift} off shift`} />
        {safety && <Tile icon="safety" tone={safety.safe ? 'green' : 'red'} value={safety.safe ? 'SAFE' : 'UNSAFE'} label="System state" sub={deadlock?.deadlocked ? 'Deadlock detected' : 'No deadlock'} />}
      </div>

      <div className="grid-3">
        <Card title="Order states" desc="Distribution across the production lifecycle">
          {segments.length ? <Donut segments={segments} centerLabel="orders" /> : <Empty>No orders yet.</Empty>}
        </Card>

        <Card title="Machine floor" desc="Current status of each machine">
          {machines.length === 0 ? <Empty icon="cpu">No machines yet.</Empty> : (
            <div className="people-list">
              {machines.map((m) => (
                <div className="people-row" key={m.machine_id}>
                  <div>
                    <b>{m.machine_name}</b>
                    <div className="muted small">{m.machine_type} · {m.in_use}/{m.capacity} in use</div>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Workers" desc="Who is free and who is on an order">
          {workers.length === 0 ? <Empty icon="users">No workers yet.</Empty> : (
            <div className="people-list">
              {workers.map((w) => (
                <div className="people-row" key={w.worker_id}>
                  <div>
                    <b>{w.full_name}</b>
                    <div className="muted small">{w.current_order ? `On ${w.current_order}` : w.skill}</div>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div>
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

    </div>
  );
}
