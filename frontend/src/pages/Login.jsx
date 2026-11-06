import { useEffect, useState } from 'react';
import { api, setSession } from '../lib/api';
import Icon from '../components/icons';

const EMPTY = { full_name: '', username: '', email: '', password: '', manager_code: '' };

export default function Login({ onLogin, onBack }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [askCode, setAskCode] = useState(false);   // does this factory give out manager codes?

  useEffect(() => { api.authOptions().then((o) => setAskCode(Boolean(o?.managerCode))).catch(() => {}); }, []);

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
        {onBack && <button className="link-btn" onClick={onBack}>&lt; Back</button>}
      </div>

      <form className="auth-card" onSubmit={submit}>
        <div className="auth-head">
          <span className="brand-mark"><Icon name="factory" size={22} /></span>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p>{mode === 'login' ? 'Sign in to Smart Factory Production Scheduler' : 'Set up an account to start scheduling'}</p>
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
          <span className="auth-pass">
          <input type={show ? 'text' : 'password'} value={form.password} onChange={set('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'} required />
          <button type="button" className="auth-show" onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>
          </span>
        </label>

        {mode === 'signup' && askCode && (
          <label>Manager code <span className="muted small">(optional)</span>
            <input value={form.manager_code} onChange={set('manager_code')} autoComplete="off" placeholder="Leave empty for a view-only account" />
          </label>
        )}

        {error && <div className="form-error">{error}</div>}

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
