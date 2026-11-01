import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Card, Tile, Gantt, Empty, Icon, colorFor } from '../components/ui';

const ALGORITHMS = [
  { id: 'FCFS', name: 'First Come First Served' },
  { id: 'SJF', name: 'Shortest Job First' },
  { id: 'SRTF', name: 'Shortest Remaining Time (preemptive)' },
  { id: 'PRIORITY', name: 'Priority (non-preemptive)' },
  { id: 'PRIORITYP', name: 'Priority (preemptive)' },
  { id: 'RR', name: 'Round Robin' },
];
const METRICS = [
  ['avgWaiting', 'Avg waiting', 'lower'],
  ['avgTurnaround', 'Avg turnaround', 'lower'],
  ['avgResponse', 'Avg response', 'lower'],
  ['makespan', 'Makespan', 'lower'],
  ['throughput', 'Throughput', 'higher'],
  ['missedDeadlines', 'Missed deadlines', 'lower'],
];

export default function Scheduler() {
  const [mode, setMode] = useState('run');          // 'run' | 'compare'
  const [algorithm, setAlgorithm] = useState('SJF');
  const [quantum, setQuantum] = useState(2);
  const [queue, setQueue] = useState([]);
  const [result, setResult] = useState(null);
  const [compare, setCompare] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/api/orders').then((os) => setQueue(os.filter((o) => o.status !== 'COMPLETED'))).catch(() => {});
  }, [result]);

  async function run() {
    setBusy(true); setErr('');
    try { setResult(await api.post('/api/os/schedule', { algorithm, quantum: +quantum })); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function runCompare() {
    setBusy(true); setErr('');
    try { setCompare(await api.post('/api/os/compare', { quantum: +quantum })); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  // best value per metric for highlighting
  const best = {};
  if (compare?.rows?.length) {
    for (const [key, , dir] of METRICS) {
      const vals = compare.rows.map((r) => r[key]);
      best[key] = dir === 'lower' ? Math.min(...vals) : Math.max(...vals);
    }
  }

  return (
    <div className="stack">
      <Card title="Scheduling engine" desc="Each order is treated as a process and scheduled by the chosen policy.">
        <div className="scheduler-controls">
          <div className="seg">
            <button className={mode === 'run' ? 'on' : ''} onClick={() => setMode('run')}>Single run</button>
            <button className={mode === 'compare' ? 'on' : ''} onClick={() => setMode('compare')}>Compare all</button>
          </div>
          {mode === 'run' && (
            <label style={{ minWidth: 240 }}>Algorithm
              <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
                {ALGORITHMS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          )}
          {(mode === 'compare' || algorithm === 'RR') && (
            <label style={{ maxWidth: 130 }}>Time quantum<input type="number" min="1" value={quantum} onChange={(e) => setQuantum(e.target.value)} /></label>
          )}
          <button className="btn btn-primary" onClick={mode === 'run' ? run : runCompare} disabled={busy}>
            <Icon name={busy ? 'refresh' : 'play'} size={16} className={busy ? 'spin' : ''} />
            {busy ? 'Running…' : mode === 'run' ? 'Run scheduler' : 'Compare algorithms'}
          </button>
        </div>
        {err && <div className="form-error" style={{ marginTop: 14 }}><Icon name="alert" size={16} />{err}</div>}

        <div style={{ marginTop: 18 }}>
          <div className="muted small" style={{ marginBottom: 8 }}>Ready queue ({queue.length} orders)</div>
          {queue.length === 0 ? <Empty icon="orders">No ready orders — add some on the Orders page.</Empty> : (
            <div className="queue-chips">
              {queue.map((o) => (
                <div className="queue-chip" key={o.order_id}>
                  <span className="num" style={{ color: colorFor(o.order_id) }}>#{o.order_id}</span>
                  <b>{o.product_name}</b>
                  <span className="muted num">a{o.arrival_time}·b{o.execution_time}·P{o.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* ---- single run result ---- */}
      {mode === 'run' && result && !result.empty && (
        <>
          <Card title={`Gantt chart — ${result.algorithm}`} desc="Execution timeline across the shared CPU">
            <Gantt slices={result.gantt} processes={result.processes} />
            <div className="legend">
              {result.processes.map((p) => (
                <span className="legend-item" key={p.pid}><i style={{ background: colorFor(p.pid) }} />#{p.pid} {p.product_name}</span>
              ))}
            </div>
          </Card>

          <div className="metric-row">
            <Tile icon="clock" tone="indigo" value={result.avgWaiting.toFixed(2)} label="Avg waiting time" />
            <Tile icon="refresh" tone="cyan" value={result.avgTurnaround.toFixed(2)} label="Avg turnaround" />
            <Tile icon="zap" tone="amber" value={result.avgResponse.toFixed(2)} label="Avg response" />
            <Tile icon="activity" tone="green" value={result.throughput.toFixed(3)} label="Throughput" sub="orders / unit time" />
            <Tile icon="scheduler" tone="indigo" value={result.makespan} label="Makespan" />
            <Tile icon="alert" tone={result.missedDeadlines ? 'red' : 'green'} value={result.missedDeadlines} label="Missed deadlines" />
          </div>

          <Card title="Per-order results">
            <div className="table-wrap"><table className="table">
              <thead><tr><th>ID</th><th>Product</th><th className="num">Arrival</th><th className="num">Burst</th><th>Priority</th>
              <th className="num">Start</th><th className="num">Finish</th><th className="num">Wait</th><th className="num">Turnaround</th><th className="num">Response</th><th className="num">Deadline</th></tr></thead>
              <tbody>{result.processes.map((p) => (
                <tr key={p.pid} className={p.missed_deadline ? 'row-danger' : ''}>
                  <td className="num muted">#{p.pid}</td><td><b>{p.product_name}</b></td>
                  <td className="num">{p.arrival}</td><td className="num">{p.burst}</td>
                  <td><span className={`prio prio-${p.priority}`}>P{p.priority}</span></td>
                  <td className="num">{p.start}</td><td className="num">{p.completion}</td>
                  <td className="num">{p.waiting}</td><td className="num">{p.turnaround}</td><td className="num">{p.response}</td>
                  <td className={`num ${p.missed_deadline ? 'danger' : ''}`}>{p.deadline}{p.missed_deadline ? ' ⚠' : ''}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </Card>
        </>
      )}
      {mode === 'run' && result && result.empty && <Card><Empty icon="orders">No ready orders to schedule.</Empty></Card>}

      {/* ---- comparison result ---- */}
      {mode === 'compare' && compare && !compare.empty && (
        <Card title="Algorithm comparison" desc={`All six policies over ${compare.orderCount} orders · best value in each column highlighted`}>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Algorithm</th>{METRICS.map(([, label]) => <th key={label} className="num">{label}</th>)}</tr></thead>
            <tbody>{compare.rows.map((r) => (
              <tr key={r.algorithm}>
                <td><code>{r.algorithm}</code></td>
                {METRICS.map(([key]) => {
                  const v = r[key];
                  const isBest = best[key] === v;
                  const shown = key === 'throughput' ? v.toFixed(3) : (key === 'makespan' || key === 'missedDeadlines') ? v : v.toFixed(2);
                  return <td key={key} className="num">{shown}{isBest && <span className="best-badge">best</span>}</td>;
                })}
              </tr>
            ))}</tbody>
          </table></div>
          <p className="muted small" style={{ marginTop: 12 }}>Lower is better for waiting/turnaround/response/makespan/missed; higher is better for throughput.</p>
        </Card>
      )}
      {mode === 'compare' && compare && compare.empty && <Card><Empty icon="orders">No ready orders to compare.</Empty></Card>}
    </div>
  );
}
