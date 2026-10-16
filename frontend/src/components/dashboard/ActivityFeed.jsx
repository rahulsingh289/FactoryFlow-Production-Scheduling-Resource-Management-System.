// ActivityFeed.jsx
// Member: Anmol Bhatt
// Description: Displays the latest audit log entries as a live activity
//              feed on the dashboard. Auto-refreshes every 30 seconds.

import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../../services/authService';

// Maps entity_type to a display icon
const ENTITY_ICON = {
  order:    '📋',
  machine:  '⚙️',
  worker:   '👷',
  resource: '📦',
  user:     '👤',
  schedule: '📅',
};

// Maps action prefix to colour class
const actionToClass = (action) => {
  if (action.includes('CREATED'))    return 'feed-green';
  if (action.includes('TERMINATED')) return 'feed-red';
  if (action.includes('UPDATED'))    return 'feed-blue';
  if (action.includes('ALLOCATED'))  return 'feed-purple';
  if (action.includes('RELEASED'))   return 'feed-gray';
  if (action.includes('DEADLOCK'))   return 'feed-red';
  return 'feed-gray';
};

const REFRESH_INTERVAL = 30000; // 30 seconds

const ActivityFeed = () => {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      // Fetch the 10 most recent audit events
      const data = await getAuditLogs({ limit: 10 });
      setLogs(data);
    } catch {
      // Silently fail — activity feed is non-critical
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="activity-feed" aria-label="Recent Activity">
      <h2 className="feed-title">Recent Activity</h2>

      {loading && <p className="loading-text" aria-busy="true">Loading activity...</p>}

      {!loading && logs.length === 0 && (
        <p className="empty-state">No recent activity.</p>
      )}

      {!loading && logs.length > 0 && (
        <ul className="feed-list" aria-label="Activity log entries">
          {logs.map((log) => (
            <li
              key={log.log_id}
              className={`feed-item ${actionToClass(log.action)}`}
            >
              <span className="feed-icon" aria-hidden="true">
                {ENTITY_ICON[log.entity_type] || '🔔'}
              </span>
              <div className="feed-content">
                <p className="feed-action">
                  <strong>{log.action.replace(/_/g, ' ')}</strong>
                  {' '}on {log.entity_type} #{log.entity_id}
                </p>
                <p className="feed-time">
                  {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ActivityFeed;
