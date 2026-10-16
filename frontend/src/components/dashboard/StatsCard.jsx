// StatsCard.jsx
// Member: Anmol Bhatt
// Description: Reusable summary card for the dashboard home.
//              Displays a metric with a label, value, icon, and
//              optional trend indicator (up/down/neutral).

import React from 'react';

// Props:
//   title       — metric label e.g. "Total Orders"
//   value       — metric value e.g. 42 or "87.5%"
//   icon        — emoji or icon string
//   colorClass  — CSS class for accent colour: "card-blue" | "card-green" | etc.
//   trend       — optional: { direction: "up"|"down"|"neutral", value: "12%" }
//   subtitle    — optional small text below value
const StatsCard = ({ title, value, icon, colorClass = 'card-blue', trend, subtitle }) => {
  const trendIcon =
    trend?.direction === 'up'      ? '↑' :
    trend?.direction === 'down'    ? '↓' : '→';

  const trendClass =
    trend?.direction === 'up'      ? 'trend-up' :
    trend?.direction === 'down'    ? 'trend-down' : 'trend-neutral';

  return (
    <article className={`stats-card ${colorClass}`} aria-label={`${title}: ${value}`}>
      <div className="stats-card-body">
        <div className="stats-card-info">
          <p className="stats-card-title">{title}</p>
          <p className="stats-card-value">{value}</p>
          {subtitle && <p className="stats-card-subtitle">{subtitle}</p>}
          {trend && (
            <p className={`stats-card-trend ${trendClass}`} aria-label={`Trend ${trend.direction}`}>
              {trendIcon} {trend.value}
            </p>
          )}
        </div>
        <span className="stats-card-icon" aria-hidden="true">{icon}</span>
      </div>
    </article>
  );
};

export default StatsCard;
