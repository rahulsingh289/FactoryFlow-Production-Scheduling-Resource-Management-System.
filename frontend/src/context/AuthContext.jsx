// AuthContext.jsx
// Member: Anmol Bhatt
// Description: React context that provides authentication state to the
//              entire app. Wraps the app in AuthProvider so any component
//              can call useAuth() to get the current user and auth actions.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout, getStoredUser, isAuthenticated } from '../services/authService';

// Create the context
const AuthContext = createContext(null);

// AuthProvider: wrap the app root with this
export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(getStoredUser);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Sync user from localStorage on mount
  useEffect(() => {
    if (!isAuthenticated()) {
      setUser(null);
    }
  }, []);

  // login: call API, update context state
  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiLogin({ username, password });
      setUser(data.user);
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // logout: call API, clear context state
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setLoading(false);
    }
  }, []);

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin:   user?.role === 'ADMIN',
    isManager: user?.role === 'ADMIN' || user?.role === 'MANAGER',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// useAuth hook — use inside any component
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export default AuthContext;
