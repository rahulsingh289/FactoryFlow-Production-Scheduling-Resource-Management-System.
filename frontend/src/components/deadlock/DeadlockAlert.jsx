// DeadlockAlert.jsx
// Member: Rahul Singh
// Description: Polls the deadlock detection endpoint periodically and
//              shows a prominent alert banner if a deadlock is found.
//              Lets the manager trigger resolution with one click.

import React, { useState, useEffect } from 'react';
import { checkDeadlock, resolveDeadlock } from '../../services/resourceService';

const POLL_INTERVAL = 15000; // check every 15 seconds

const DeadlockAlert = () => {
  const [report, setReport]       = useState(null);
  const [resolving, setResolving] = useState(false);
  const [resolveMsg, setResolveMsg] = useState('');

  // Poll deadlock endpoint
  useEffect(() => {
    const runCheck = async () => {
      try {
        const data = await checkDeadlock();
        setReport(data);
      } catch {
        // Silent fail — don't interrupt UI for a failed poll
      }
    };

    runCheck(); // immediate first check
    const interval = setInterval(runCheck, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Handle resolve button
  const handleResolve = async () => {
    setResolving(true);
    setResolveMsg('');
    try {
      const result = await resolveDeadlock();
      setResolveMsg(result.message || 'Resolution triggered.');
      // Re-check after resolution
      const updated = await checkDeadlock();
      setReport(updated);
    } catch {
      setResolveMsg('Resolution failed. Please try again.');
    } finally {
      setResolving(false);
    }
  };

  // No deadlock — render nothing (clean UI)
  if (!report || !report.deadlock_found) return null;

  return (
    <div
      className="deadlock-alert"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {/* Alert header */}
      <div className="deadlock-alert-header">
        <span className="deadlock-icon" aria-hidden="true">🔴</span>
        <strong>Deadlock Detected!</strong>
        <span className="deadlock-time">at {new Date(report.detected_at).toLocaleTimeString()}</span>
      </div>

      {/* Details */}
      <div className="deadlock-alert-body">
        <p>
          <strong>Deadlocked Orders:</strong>{' '}
          {report.deadlocked_order_ids?.join(', ') || 'N/A'}
        </p>
        <p>
          <strong>Involved Resources:</strong>{' '}
          {report.deadlocked_resource_ids?.join(', ') || 'N/A'}
        </p>
        <p>
          <strong>Suggested Resolution:</strong>{' '}
          {report.suggested_resolution}
        </p>
      </div>

      {/* Resolve button */}
      <div className="deadlock-alert-footer">
        <button
          className="btn btn-danger"
          onClick={handleResolve}
          disabled={resolving}
          aria-label="Resolve deadlock by terminating lowest-priority process"
        >
          {resolving ? 'Resolving...' : 'Resolve Deadlock'}
        </button>
        {resolveMsg && (
          <span className="resolve-message" aria-live="polite">{resolveMsg}</span>
        )}
      </div>
    </div>
  );
};

export default DeadlockAlert;
