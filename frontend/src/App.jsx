import React, { useEffect, useState } from 'react';
import { getUser, clearSession } from './lib/api';
import Icon from './components/icons';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Scheduler from './pages/Scheduler';
import Machines from './pages/Machines';
import Workers from './pages/Workers';
import Resources from './pages/Resources';
import Bankers from './pages/Bankers';
import Reports from './pages/Reports';

// If a page hits an unexpected error while drawing, show this instead of a blank screen.
class PageCrash extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Page error:', error); }
  componentDidUpdate(prev) { if (prev.pageId !== this.props.pageId && this.state.failed) this.setState({ failed: false }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="card"><div className="card-body">
        <h2>Something went wrong on this page</h2>
        <p className="muted">Your data is safe. Reload the page, or open another page from the menu.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
      </div></div>
    );
  }
}

const NAV = [
  { group: 'Operations', items: [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', title: 'Overview', desc: 'Summary of the factory', C: Dashboard },
    { id: 'orders', icon: 'orders', label: 'Production Orders', title: 'Production Orders', desc: 'Add and manage orders', C: Orders },
    { id: 'scheduler', icon: 'scheduler', label: 'Scheduler', title: 'Scheduling Engine', desc: 'Run a scheduling algorithm on the ready orders', C: Scheduler },
  ]},
  { group: 'Resources & Safety', items: [
    { id: 'machines', icon: 'cpu', label: 'Machines', title: 'Machines', desc: 'The factory\'s machines and their status', C: Machines },
    { id: 'workers', icon: 'users', label: 'Workers', title: 'Workers', desc: 'Workers and their shifts', C: Workers },
    { id: 'resources', icon: 'resources', label: 'Inventory & Pools', title: 'Inventory & Resource Pools', desc: "Raw materials and resource pools", C: Resources },
    { id: 'bankers', icon: 'safety', label: 'Safety & Deadlock', title: "Banker's Algorithm & Deadlock", desc: 'Safe state, requests and deadlock', C: Bankers },
  ]},
  { group: 'Analytics', items: [
    { id: 'reports', icon: 'reports', label: 'Reports', title: 'Reports', desc: 'Scheduling history and performance', C: Reports },
  ]},
];
const ALL = NAV.flatMap((g) => g.items);

// The open page lives in the address (#orders), so refreshing or going back stays put.
const pageFromHash = () => {
  const id = window.location.hash.slice(1);
  return ALL.some((n) => n.id === id) ? id : 'dashboard';
};

export default function App() {
  const [user, setUser] = useState(getUser());
  const [authView, setAuthView] = useState('home'); // 'home' | 'login'
  const [page, setPageState] = useState(pageFromHash);
  const setPage = (id) => { window.location.hash = id; setPageState(id); };
  useEffect(() => {
    const onHash = () => setPageState(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!user) {
    return authView === 'login'
      ? <Login onLogin={setUser} onBack={() => setAuthView('home')} />
      : <Home onSignIn={() => setAuthView('login')} />;
  }

  const active = ALL.find((n) => n.id === page) || ALL[0];
  const Current = active.C;
  const initials = (user.name || user.username || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Icon name="factory" size={20} /></span>
          <div className="brand-name">Smart Factory</div>
        </div>
        <nav>
          {NAV.map((g) => (
            <React.Fragment key={g.group}>
              <div className="nav-group-label">{g.group}</div>
              {g.items.map((n) => (
                <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
                  <Icon name={n.icon} size={18} />{n.label}
                </button>
              ))}
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-row">
            <div className="avatar">{initials}</div>
            <div className="user-meta"><b>{user.name}</b><span>{user.role}</span></div>
            <button className="btn btn-sm" onClick={() => { clearSession(); setUser(null); }}>Sign out</button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title"><h2>{active.title}</h2><p>{active.desc}</p></div>
          {user.role !== 'MANAGER' && <div className="role-note">View-only account. You can start and finish orders and run the scheduler.</div>}
        </header>
        <div className="page"><PageCrash pageId={active.id}><Current /></PageCrash></div>
      </main>
    </div>
  );
}
