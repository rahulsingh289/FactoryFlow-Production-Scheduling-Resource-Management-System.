// App.jsx
// Shared setup by all members
// Description: Root component — sets up routing and wraps the app in
//              AuthProvider so all pages have access to auth state.
//              Routes are grouped by member ownership.

import React from 'react';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';

// ── Page-level imports ────────────────────────────────────────────────────────
// Member 4 (Anmol) — Auth & Dashboard
import LoginForm from './components/auth/LoginForm';
import DashboardHome from './components/dashboard/DashboardHome';

// Member 1 (Aman) — Orders & Schedule
import OrderList from './components/orders/OrderList';
import ScheduleView from './components/schedule/ScheduleView';

// Member 2 (Rahul) — Resources & Deadlock
import ResourcePanel from './components/resources/ResourcePanel';

// Member 3 (Karan) — Machines & Workers
import MachineList from './components/machines/MachineList';
import WorkerList from './components/workers/WorkerList';

// Simple hash-based router (React Router added in Phase 5)
const getPage = () => window.location.pathname;

const App = () => {
  const page = getPage();

  const renderPage = () => {
    // Public route
    if (page === '/login' || page === '/') {
      return <LoginForm onSuccess={() => { window.location.href = '/dashboard'; }} />;
    }

    // All routes below require authentication
    const protectedPages = {
      '/dashboard': <DashboardHome />,
      '/orders':    <OrderList />,
      '/schedule':  <ScheduleView />,
      '/resources': <ResourcePanel />,
      '/machines':  <MachineList />,
      '/workers':   <WorkerList />,
    };

    const Component = protectedPages[page];
    if (Component) {
      return <ProtectedRoute>{Component}</ProtectedRoute>;
    }

    // 404
    return (
      <div className="not-found">
        <h1>404 — Page Not Found</h1>
        <a href="/dashboard" className="btn btn-primary">Go to Dashboard</a>
      </div>
    );
  };

  return (
    <AuthProvider>
      <div className="app-root">
        {renderPage()}
      </div>
    </AuthProvider>
  );
};

export default App;
