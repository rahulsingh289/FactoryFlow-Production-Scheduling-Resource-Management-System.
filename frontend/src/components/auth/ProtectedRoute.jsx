// ProtectedRoute.jsx
// Member: Anmol Bhatt
// Description: Wrapper component that redirects unauthenticated users
//              to the login page. Also supports role-based access control.
//              Use this to guard any route that requires login.

import React from 'react';
import { useAuth } from '../../context/AuthContext';

// Props:
//   children       — the protected page component
//   requiredRole   — optional: 'ADMIN' | 'MANAGER' | 'OPERATOR'
//                   if provided, user must have this role or higher
//   fallback       — optional: component to show if unauthorized (default: redirect)
const ProtectedRoute = ({ children, requiredRole, fallback }) => {
  const { isAuthenticated, user, loading } = useAuth();

  // Show nothing while auth state is loading
  if (loading) {
    return (
      <div className="auth-loading" aria-busy="true" aria-label="Checking authentication">
        <p>Loading...</p>
      </div>
    );
  }

  // Not logged in — redirect to login
  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  // Role check
  if (requiredRole) {
    const roleHierarchy = { VIEWER: 1, OPERATOR: 2, MANAGER: 3, ADMIN: 4 };
    const userLevel     = roleHierarchy[user?.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      return fallback || (
        <div className="access-denied" role="alert">
          <h2>Access Denied</h2>
          <p>You need <strong>{requiredRole}</strong> access to view this page.</p>
          <p>Your current role: <strong>{user?.role}</strong></p>
          <a href="/dashboard" className="btn btn-primary">Back to Dashboard</a>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;
