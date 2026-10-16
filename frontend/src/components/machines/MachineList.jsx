// MachineList.jsx
// Member: Karan Singh
// Description: Fetches and displays all machines in a filterable grid.
//              Shows a summary bar (total / idle / busy / maintenance / offline)
//              at the top. Handles quick status updates inline.

import React, { useState, useEffect, useCallback } from 'react';
import MachineCard from './MachineCard';
import MachineForm from './MachineForm';
import {
  getAllMachines,
  getMachineSummary,
  updateMachineStatus,
} from '../../services/machineService';

const STATUS_FILTERS = ['ALL', 'IDLE', 'BUSY', 'MAINTENANCE', 'OFFLINE'];
const TYPE_FILTERS   = ['ALL', 'CNC', 'Lathe', 'Welding', 'Assembly', 'Painting'];

const MachineList = () => {
  const [machines, setMachines]       = useState([]);
  const [summary, setSummary]         = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter]   = useState('ALL');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showForm, setShowForm]       = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null); // for maintenance view

  // ── Fetch machines + summary ───────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      if (typeFilter   !== 'ALL') filters.type   = typeFilter;

      const [machineData, summaryData] = await Promise.all([
        getAllMachines(filters),
        getMachineSummary(),
      ]);
      setMachines(machineData);
      setSummary(summaryData);
    } catch {
      setError('Failed to load machines.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Quick status update ────────────────────────────────────────────────────
  const handleStatusChange = async (machine, newStatus) => {
    try {
      await updateMachineStatus(machine.machine_id, newStatus);
      // Optimistic update
      setMachines((prev) =>
        prev.map((m) =>
          m.machine_id === machine.machine_id ? { ...m, status: newStatus } : m
        )
      );
    } catch {
      setError('Failed to update machine status.');
    }
  };

  // ── After new machine created ──────────────────────────────────────────────
  const handleMachineCreated = (newMachine) => {
    setShowForm(false);
    setMachines((prev) => [newMachine, ...prev]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="machine-list-container" aria-label="Machine Management">

      {/* Page header */}
      <div className="machine-list-header">
        <h1>Machines</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm((p) => !p)}
          aria-expanded={showForm}
        >
          {showForm ? 'Cancel' : '+ Add Machine'}
        </button>
      </div>

      {/* Summary bar */}
      {summary && (
        <div className="machine-summary-bar" aria-label="Machine status summary">
          <div className="summary-chip summary-total">
            <span className="summary-count">{summary.total}</span>
            <span className="summary-label">Total</span>
          </div>
          <div className="summary-chip summary-idle">
            <span className="summary-count">{summary.idle}</span>
            <span className="summary-label">Idle</span>
          </div>
          <div className="summary-chip summary-busy">
            <span className="summary-count">{summary.busy}</span>
            <span className="summary-label">Busy</span>
          </div>
          <div className="summary-chip summary-maintenance">
            <span className="summary-count">{summary.maintenance}</span>
            <span className="summary-label">Maintenance</span>
          </div>
          <div className="summary-chip summary-offline">
            <span className="summary-count">{summary.offline}</span>
            <span className="summary-label">Offline</span>
          </div>
        </div>
      )}

      {/* Inline create form */}
      {showForm && (
        <MachineForm
          onSuccess={handleMachineCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filter row */}
      <div className="filter-row">
        {/* Status filter */}
        <div className="filter-group">
          <label>Status:</label>
          <div className="filter-tabs" role="tablist">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={statusFilter === f}
                className={`filter-tab ${statusFilter === f ? 'active' : ''}`}
                onClick={() => setStatusFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Type filter */}
        <div className="filter-group">
          <label htmlFor="type-filter">Type:</label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {TYPE_FILTERS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {error   && <div className="alert alert-error" role="alert">{error}</div>}
      {loading && <p className="loading-text" aria-busy="true">Loading machines...</p>}

      {/* Empty state */}
      {!loading && machines.length === 0 && !error && (
        <p className="empty-state">No machines found for the selected filters.</p>
      )}

      {/* Machine cards grid */}
      {!loading && machines.length > 0 && (
        <div className="machine-cards-grid">
          {machines.map((machine) => (
            <MachineCard
              key={machine.machine_id}
              machine={machine}
              onStatusChange={handleStatusChange}
              onViewMaintenance={setSelectedMachine}
            />
          ))}
        </div>
      )}

      {/* Maintenance log panel */}
      {selectedMachine && (
        <div className="maintenance-panel" role="dialog" aria-modal="true"
             aria-label={`Maintenance log — ${selectedMachine.machine_name}`}>
          <div className="panel-header">
            <h2>Maintenance Log — {selectedMachine.machine_name}</h2>
            <button className="btn btn-sm btn-outline"
              onClick={() => setSelectedMachine(null)}>Close</button>
          </div>
          <p className="panel-hint">
            Full maintenance records load here (Phase 5 integration).
          </p>
        </div>
      )}

    </section>
  );
};

export default MachineList;
