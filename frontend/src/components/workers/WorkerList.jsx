// WorkerList.jsx
// Member: Karan Singh
// Description: Fetches and displays all workers with status summary,
//              skill/shift/status filtering, and inline assignment actions.

import React, { useState, useEffect, useCallback } from 'react';
import WorkerCard from './WorkerCard';
import WorkerForm from './WorkerForm';
import {
  getAllWorkers,
  getWorkerSummary,
  updateWorkerStatus,
} from '../../services/machineService';

const STATUS_FILTERS = ['ALL', 'AVAILABLE', 'ASSIGNED', 'ON_LEAVE', 'INACTIVE'];
const SHIFT_FILTERS  = ['ALL', 'MORNING', 'AFTERNOON', 'NIGHT', 'FLEXIBLE'];

const WorkerList = () => {
  const [workers, setWorkers]           = useState([]);
  const [summary, setSummary]           = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter]   = useState('ALL');
  const [skillSearch, setSkillSearch]   = useState('');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [showForm, setShowForm]         = useState(false);

  // ── Fetch workers + summary ────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      if (shiftFilter  !== 'ALL') filters.shift  = shiftFilter;
      if (skillSearch.trim())     filters.skill  = skillSearch.trim();

      const [workerData, summaryData] = await Promise.all([
        getAllWorkers(filters),
        getWorkerSummary(),
      ]);
      setWorkers(workerData);
      setSummary(summaryData);
    } catch {
      setError('Failed to load workers.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, shiftFilter, skillSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Status update ──────────────────────────────────────────────────────────
  const handleStatusChange = async (worker, newStatus) => {
    try {
      await updateWorkerStatus(worker.worker_id, newStatus);
      setWorkers((prev) =>
        prev.map((w) =>
          w.worker_id === worker.worker_id ? { ...w, status: newStatus } : w
        )
      );
    } catch {
      setError('Failed to update worker status.');
    }
  };

  const handleWorkerCreated = (newWorker) => {
    setShowForm(false);
    setWorkers((prev) => [newWorker, ...prev]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="worker-list-container" aria-label="Worker Management">

      {/* Page header */}
      <div className="worker-list-header">
        <h1>Workers</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm((p) => !p)}
          aria-expanded={showForm}
        >
          {showForm ? 'Cancel' : '+ Add Worker'}
        </button>
      </div>

      {/* Summary bar */}
      {summary && (
        <div className="worker-summary-bar" aria-label="Worker status summary">
          {[
            { label: 'Total',     value: summary.total,     cls: 'summary-total'     },
            { label: 'Available', value: summary.available, cls: 'summary-idle'      },
            { label: 'Assigned',  value: summary.assigned,  cls: 'summary-busy'      },
            { label: 'On Leave',  value: summary.on_leave,  cls: 'summary-maintenance'},
            { label: 'Inactive',  value: summary.inactive,  cls: 'summary-offline'   },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`summary-chip ${cls}`}>
              <span className="summary-count">{value}</span>
              <span className="summary-label">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Inline create form */}
      {showForm && (
        <WorkerForm
          onSuccess={handleWorkerCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filters */}
      <div className="filter-row">
        {/* Status filter */}
        <div className="filter-group">
          <label>Status:</label>
          <div className="filter-tabs" role="tablist">
            {STATUS_FILTERS.map((f) => (
              <button key={f} role="tab" aria-selected={statusFilter === f}
                className={`filter-tab ${statusFilter === f ? 'active' : ''}`}
                onClick={() => setStatusFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Shift filter */}
        <div className="filter-group">
          <label htmlFor="shift-filter">Shift:</label>
          <select id="shift-filter" value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}>
            {SHIFT_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Skill search */}
        <div className="filter-group">
          <label htmlFor="skill-search">Skill:</label>
          <input
            id="skill-search"
            type="text"
            placeholder="e.g. Welding"
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
          />
        </div>
      </div>

      {error   && <div className="alert alert-error" role="alert">{error}</div>}
      {loading && <p className="loading-text" aria-busy="true">Loading workers...</p>}

      {!loading && workers.length === 0 && !error && (
        <p className="empty-state">No workers found for the selected filters.</p>
      )}

      {/* Worker cards grid */}
      {!loading && workers.length > 0 && (
        <div className="worker-cards-grid">
          {workers.map((worker) => (
            <WorkerCard
              key={worker.worker_id}
              worker={worker}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

    </section>
  );
};

export default WorkerList;
