import React, { useState } from 'react';
import { api, setSession } from '../api';
import Icon from '../components/icons';

const FEATURES = [
  ['scheduler', 'Six CPU-scheduling algorithms in C++'],
  ['safety', "Banker's Algorithm & deadlock detection"],
  ['resources', 'Machine, worker & inventory management'],
  ['reports', 'MySQL-backed history and analytics'],
];

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('manager');
  const [password, setPassword] = useState('manager123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const { token, user } = await api.login(username, password);
      setSession(token, user);
      onLogin(user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <div className="login-art">
        <div className="login-art-top">
          <span className="brand-mark"><Icon name="factory" size={22} /></span>
          <div><div className="brand-name">Smart Factory</div><div className="brand-sub">Production Scheduler</div></div>
        </div>
        <div>
          <h1>Schedule production like an operating system.</h1>
          <p>Model every production order as a process, schedule it with classic OS
          algorithms, and allocate factory resources safely — all backed by MySQL.</p>
        </div>
        <div className="login-feats">
          {FEATURES.map(([ic, t]) => (
            <div className="login-feat" key={t}><Icon name={ic} />{t}</div>
          ))}
        </div>
      </div>

      <div className="login-form-wrap">
        <form className="login-card" onSubmit={submit}>
          <h2>Sign in</h2>
          <p className="sub">Welcome back — access the operations console.</p>
          <label>Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </label>
          <label>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div className="form-error"><Icon name="alert" size={16} />{error}</div>}
          <button className="btn btn-primary" disabled={busy} style={{ justifyContent: 'center', padding: '11px' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="login-hint">
            <b>Demo accounts</b>
            <span>Manager — <code>manager</code> / <code>manager123</code></span>
            <span>Operator — <code>operator</code> / <code>operator123</code></span>
          </div>
        </form>
      </div>
    </div>
  );
}
