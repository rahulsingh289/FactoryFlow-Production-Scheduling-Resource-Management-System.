// LoginForm.jsx
// Member: Anmol Bhatt
// Description: Login page component. Validates credentials on the client,
//              calls the auth API via AuthContext, and redirects to the
//              dashboard on success.

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const LoginForm = ({ onSuccess }) => {
  const { login, loading, error: authError, isAuthenticated } = useAuth();

  const [form, setForm]           = useState({ username: '', password: '' });
  const [errors, setErrors]       = useState({});
  const [showPassword, setShowPassword] = useState(false);

  // If already logged in, skip to dashboard
  useEffect(() => {
    if (isAuthenticated && onSuccess) onSuccess();
  }, [isAuthenticated, onSuccess]);

  // ── Field change ─────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = 'Username or email is required';
    if (!form.password)        errs.password = 'Password is required';
    else if (form.password.length < 4) errs.password = 'Password is too short';
    return errs;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    try {
      await login(form.username, form.password);
      if (onSuccess) onSuccess();
    } catch {
      // Error is handled by AuthContext and surfaced via authError
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="login-page" aria-label="Login page">
      <div className="login-card">

        {/* Logo / branding */}
        <div className="login-header">
          <span className="login-logo" aria-hidden="true">🏭</span>
          <h1 className="login-title">Smart Factory</h1>
          <p className="login-subtitle">Production Scheduler</p>
        </div>

        {/* API error banner */}
        {authError && (
          <div className="alert alert-error" role="alert" aria-live="polite">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="login-form">

          {/* Username */}
          <div className="form-group">
            <label htmlFor="username">Username or Email</label>
            <input
              id="username"
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Enter your username or email"
              autoComplete="username"
              autoFocus
              aria-describedby={errors.username ? 'username-error' : undefined}
              aria-invalid={!!errors.username}
            />
            {errors.username && (
              <span id="username-error" className="field-error" role="alert">
                {errors.username}
              </span>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete="current-password"
                aria-describedby={errors.password ? 'password-error' : undefined}
                aria-invalid={!!errors.password}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {errors.password && (
              <span id="password-error" className="field-error" role="alert">
                {errors.password}
              </span>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

        </form>

        {/* Footer hint */}
        <p className="login-footer-hint">
          Contact your system administrator to create an account.
        </p>

      </div>
    </div>
  );
};

export default LoginForm;
