// DashboardHome.jsx
// Member: Anmol Bhatt
// Description: Main dashboard landing page shown after login.
//              Displays summary stats cards, a deadlock alert banner,
//              a recent activity feed, and quick-action buttons.
//              Polls the summary endpoint every 30 seconds for live data.

import React, { useState, useEffect, useCallback } from 'react';
import StatsCard from './StatsCard';
import ActivityFeed from './ActivityFeed';
import DeadlockAlert from '../deadlock/DeadlockAlert';
import { getDashboardSummary } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

const REFRESH_INTERVAL = 30000; // 30 seconds

const DashboardHome = () => {
  const { user, logout }           = useAuth();
  const [summary, setSummary]      = useState(null);
  const [loading, setLoading]      = useState(true);
  const [error, setError]          = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── Fetch summary stats ───────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      const data = await getDashboardSummary();
      setSummary(data);
      setLastUpdated(new Date());
      setError('');
    } catch {
      setError('Failed to load dashboard stats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  // ── Logout handler ────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    // AuthContext clears localStorage; app router will redirect to /login
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="dashboard-home" aria-label="Dashboard">

      {/* Top bar */}
      <div className="dashboard-topbar">
        <div className="topbar-left">
          <span className="topbar-logo" aria-hidden="true">🏭</span>
          <h1 className="topbar-title">Smart Factory Scheduler</h1>
        </div>
        <div className="topbar-right">
          {lastUpdated && (
            <span className="last-updated" aria-live="polite">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <div className="user-info">
            <span className="user-avatar" aria-hidden="true">👤</span>
            <span className="user-name">{user?.full_name || user?.username}</span>
            <span className="user-role-badge">{user?.role}</span>
          </div>
          <button
            className="btn btn-sm btn-outline"
            onClick={handleLogout}
            aria-label="Log out"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Deadlock alert — renders only if deadlock is detected */}
      <DeadlockAlert />

      {/* Error banner */}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {/* Stats cards row */}
      <section className="stats-grid" aria-label="Factory summary statistics">
        {loading ? (
          <p className="loading-text" aria-busy="true">Loading stats...</p>
        ) : (
          <>
            <StatsCard
              title="Total Orders"
              value={summary?.total_orders ?? '—'}
              icon="📋"
              colorClass="card-blue"
              subtitle="All time"
            />
            <StatsCard
              title="Completed Today"
              value={summary?.completed_today ?? '—'}
              icon="✅"
              colorClass="card-green"
            />
            <StatsCard
              title="Avg Turnaround"
              value={summary?.avg_turnaround
                ? `${summary.avg_turnaround} min`
                : '—'}
              icon="⏱️"
              colorClass="card-purple"
            />
            <StatsCard
              title="Deadline Hit Rate"
              value={summary?.deadline_hit_rate
                ? `${summary.deadline_hit_rate}%`
                : '—'}
              icon="🎯"
              colorClass="card-teal"
              trend={summary?.deadline_hit_rate
                ? {
                    direction: summary.deadline_hit_rate >= 80 ? 'up' : 'down',
                    value: `${summary.deadline_hit_rate}%`,
                  }
                : undefined}
            />
            <StatsCard
              title="Machine Utilization"
              value={summary?.machine_utilization
                ? `${summary.machine_utilization}%`
                : '—'}
              icon="⚙️"
              colorClass="card-orange"
            />
            <StatsCard
              title="Worker Utilization"
              value={summary?.worker_utilization
                ? `${summary.worker_utilization}%`
                : '—'}
              icon="👷"
              colorClass="card-yellow"
            />
          </>
        )}
      </section>

      {/* Quick action buttons */}
      <section className="quick-actions" aria-label="Quick actions">
        <h2>Quick Actions</h2>
        <div className="quick-actions-grid">
          <a href="/orders/new" className="quick-action-card">
            <span aria-hidden="true">➕</span>
            <span>New Order</span>
          </a>
          <a href="/schedule" className="quick-action-card">
            <span aria-hidden="true">📅</span>
            <span>Run Scheduler</span>
          </a>
          <a href="/resources" className="quick-action-card">
            <span aria-hidden="true">📦</span>
            <span>Resources</span>
          </a>
          <a href="/machines" className="quick-action-card">
            <span aria-hidden="true">⚙️</span>
            <span>Machines</span>
          </a>
          <a href="/workers" className="quick-action-card">
            <span aria-hidden="true">👷</span>
            <span>Workers</span>
          </a>
          <a href="/reports" className="quick-action-card">
            <span aria-hidden="true">📊</span>
            <span>Reports</span>
          </a>
        </div>
      </section>

      {/* Activity feed */}
      <section className="dashboard-bottom-row">
        <ActivityFeed />
      </section>

    </main>
  );
};

export default DashboardHome;
