// Shared UI building blocks for the dashboard.
import React from 'react';
import Icon from './icons';

const PALETTE = ['#c6490f', '#2b6f6a', '#3f6ea0', '#9a6f17', '#7c5aa6', '#4a8a5a', '#b2524a', '#5f7a3a'];
export function colorFor(pid) {
  return PALETTE[(Math.abs(pid) - 1) % PALETTE.length] || PALETTE[0];
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${(status || '').toLowerCase()}`}><i className="dot" />{status}</span>;
}

export function Tile({ icon, tone = 'indigo', value, label, sub }) {
  return (
    <div className="tile">
      <div className={`tile-ic ${tone}`}><Icon name={icon} /></div>
      <div>
        <div className="tile-value num">{value}</div>
        <div className="tile-label">{label}</div>
        {sub != null && <div className="tile-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function Card({ title, desc, actions, children, className = '', pad = true }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>{title && <h2>{title}</h2>}{desc && <p>{desc}</p>}</div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  );
}

export function Empty({ icon = 'box', children }) {
  return <div className="empty"><Icon name={icon} size={34} /><div>{children}</div></div>;
}

// Swimlane Gantt: one lane per process, bars positioned on a shared time scale.
export function Gantt({ slices, processes }) {
  if (!slices || slices.length === 0) return <Empty icon="scheduler">No timeline to show yet.</Empty>;
  const makespan = Math.max(...slices.map((s) => s.end)) || 1;
  // lane order: by first start time
  const order = [...processes].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  const ticks = [];
  const step = makespan > 20 ? Math.ceil(makespan / 20) : 1;
  for (let t = 0; t <= makespan; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== makespan) ticks.push(makespan);

  return (
    <div className="gantt">
      {order.map((p) => {
        const mine = slices.filter((s) => s.pid === p.pid);
        return (
          <div className="gantt-row" key={p.pid}>
            <div className="gantt-label" title={p.product_name}>#{p.pid} {p.product_name}</div>
            <div className="gantt-lane">
              {mine.map((s, i) => {
                const left = (s.start / makespan) * 100;
                const width = ((s.end - s.start) / makespan) * 100;
                return (
                  <div key={i} className="gantt-bar"
                    style={{ left: `${left}%`, width: `${width}%`, background: colorFor(p.pid) }}
                    title={`${p.product_name}: ${s.start}–${s.end}`}>
                    {width > 6 ? `${s.start}-${s.end}` : ''}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="gantt-axis">
        {ticks.map((t) => (
          <span key={t} className="gantt-tick" style={{ left: `${(t / makespan) * 100}%` }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

// Donut chart from segments [{label, value, color}].
export function Donut({ segments, centerLabel }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let acc = 0;
  const stops = segments.map((s) => {
    const start = (acc / total) * 360;
    acc += s.value;
    const end = (acc / total) * 360;
    return `${s.color} ${start}deg ${end}deg`;
  }).join(', ');
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(${stops})` }}>
        <div className="donut-center"><b className="num">{total}</b><span>{centerLabel}</span></div>
      </div>
      <div className="legend-list">
        {segments.map((s) => (
          <div className="legend-row" key={s.label}>
            <i style={{ background: s.color }} /> {s.label} <b>{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Gauge({ label, value, total, color = 'var(--cyan)' }) {
  const pct = total ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="gauge">
      <div className="gauge-top"><b className="num">{value}<span> / {total}</span></b></div>
      <div className="gauge-bar"><div className="gauge-fill" style={{ width: `${pct}%`, background: color }} /></div>
      <div className="tile-label" style={{ marginTop: 6 }}>{label}</div>
    </div>
  );
}

export { Icon };
