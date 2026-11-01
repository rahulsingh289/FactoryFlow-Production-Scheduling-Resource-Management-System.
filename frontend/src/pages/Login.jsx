import React, { useState } from 'react';
import { api, setSession } from '../api';
import Icon from '../components/icons';

const EMPTY = { full_name: '', username: '', email: '', password: '' };

export default function Login({ onLogin, onBack, theme, onToggleTheme }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  function switchMode(m) { setMode(m); setError(''); }

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const { token, user } = mode === 'login'
        ? await api.login(form.username, form.password)
        : await api.register(form);
      setSession(token, user);
      onLogin(user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth-page">
      <div className="auth-top">
        {onBack && <button className="link-btn" onClick={onBack}><Icon name="logout" size={15} style={{ transform: 'scaleX(-1)' }} />Home</button>}
        <button className="icon-btn" title="Toggle theme" onClick={onToggleTheme}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
      </div>

      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <span className="brand-mark"><Icon name="factory" size={22} /></span>
          <div><div className="brand-name">Smart Factory</div><div className="brand-sub">Production Scheduler</div></div>
        </div>

        <div className="seg auth-seg">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>Sign in</button>
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => switchMode('signup')}>Create account</button>
        </div>

        {mode === 'signup' && (
          <label>Full name
            <input value={form.full_name} onChange={set('full_name')} autoComplete="name" placeholder="Jane Doe" required />
          </label>
        )}
        <label>Username
          <input value={form.username} onChange={set('username')} autoComplete="username" placeholder="janedoe" required />
        </label>
        {mode === 'signup' && (
          <label>Email
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="jane@example.com" required />
          </label>
        )}
        <label>Password
          <input type="password" value={form.password} onChange={set('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'signup' ? 'At least 6 characters' : ''} required />
        </label>

        {error && <div className="form-error"><Icon name="alert" size={16} />{error}</div>}

        <button className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <p className="auth-switch">
          {mode === 'login'
            ? <>New here? <button type="button" onClick={() => switchMode('signup')}>Create an account</button></>
            : <>Already have an account? <button type="button" onClick={() => switchMode('login')}>Sign in</button></>}
        </p>
      </form>
    </div>
  );
}
