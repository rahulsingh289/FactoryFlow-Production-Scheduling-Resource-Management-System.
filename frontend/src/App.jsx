import React, { useEffect, useState } from 'react';
import { api, getUser, clearSession } from './api';
import Icon from './components/icons';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Scheduler from './pages/Scheduler';
import Resources from './pages/Resources';
import Bankers from './pages/Bankers';
import Reports from './pages/Reports';

const NAV = [
  { group: 'Operations', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', title: 'Overview', desc: 'Live production and resource snapshot', C: Dashboard },
    { id: 'orders', label: 'Production Orders', icon: 'orders', title: 'Production Orders', desc: 'Create and manage orders (OS processes)', C: Orders },
    { id: 'scheduler', label: 'Scheduler', icon: 'scheduler', title: 'Scheduling Engine', desc: 'Run CPU-scheduling policies on the order queue', C: Scheduler },
  ]},
  { group: 'Resources & Safety', items: [
    { id: 'resources', label: 'Resources', icon: 'resources', title: 'Factory Resources', desc: 'Machines, workers, inventory and resource pools', C: Resources },
    { id: 'bankers', label: 'Safety & Deadlock', icon: 'safety', title: "Banker's Algorithm & Deadlock", desc: 'Safe-state analysis and deadlock detection', C: Bankers },
  ]},
  { group: 'Analytics', items: [
    { id: 'reports', label: 'Reports', icon: 'reports', title: 'Reports & Audit', desc: 'Scheduling history and activity log', C: Reports },
  ]},
];
const ALL = NAV.flatMap((g) => g.items);

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('sf_theme');
      if (saved) return saved;
    } catch {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('sf_theme', theme); } catch {}
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

export default function App() {
  const [user, setUser] = useState(getUser());
  const [page, setPage] = useState('dashboard');
  const [health, setHealth] = useState(null);
  const [theme, toggleTheme] = useTheme();

  useEffect(() => { if (user) api.health().then(setHealth).catch(() => setHealth(null)); }, [user]);

  if (!user) return <Login onLogin={setUser} />;

  const active = ALL.find((n) => n.id === page) || ALL[0];
  const Current = active.C;
  const initials = (user.name || user.username || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Icon name="factory" size={22} /></span>
          <div><div className="brand-name">Smart Factory</div><div className="brand-sub">Production Scheduler</div></div>
        </div>
        <nav>
          {NAV.map((g) => (
            <React.Fragment key={g.group}>
              <div className="nav-group-label">{g.group}</div>
              {g.items.map((n) => (
                <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
                  <Icon name={n.icon} />{n.label}
                </button>
              ))}
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-row">
            <div className="avatar">{initials}</div>
            <div className="user-meta"><b>{user.name}</b><span>{user.role}</span></div>
            <button className="icon-btn" title="Sign out" onClick={() => { clearSession(); setUser(null); }}>
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title"><h2>{active.title}</h2><p>{active.desc}</p></div>
          <div className="topbar-right">
            {health && (
              <>
                <span className={`pill ${health.dbMode === 'mysql' ? 'pill-ok' : 'pill-warn'}`}>
                  <span className="dot" />{health.dbMode === 'mysql' ? 'MySQL' : 'Demo data'}
                </span>
                <span className={`pill ${health.engineBuilt ? 'pill-ok' : 'pill-warn'}`}>
                  <span className="dot" />C++ engine
                </span>
              </>
            )}
            <button className="icon-btn" title="Toggle theme" onClick={toggleTheme} style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
          </div>
        </header>
        {health && health.dbMode !== 'mysql' && (
          <div className="banner">
            <Icon name="alert" />
            <span>Running in <b>demo mode</b> with in-memory data. Start MySQL and configure <code>backend/.env</code> to persist to the database.</span>
          </div>
        )}
        <div className="page"><Current /></div>
      </main>
    </div>
  );
}
