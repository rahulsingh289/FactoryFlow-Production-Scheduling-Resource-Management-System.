// ResourcePanel.jsx
// Member: Rahul Singh
// Description: Main resource management panel. Fetches all resources,
//              displays them as ResourceCards, handles allocation/release
//              actions inline, and auto-polls for live availability updates.

import React, { useState, useEffect, useCallback } from 'react';
import ResourceCard from './ResourceCard';
import AllocationStatus from './AllocationStatus';
import {
  getAllResources,
  allocateResource,
  releaseResource,
} from '../../services/resourceService';

// Resource type filter options
const TYPE_FILTERS = ['ALL', 'MACHINE', 'ROBOT', 'MATERIAL', 'WORKER'];

// Poll interval in ms — keeps availability live without manual refresh
const POLL_INTERVAL = 10000; // 10 seconds

const ResourcePanel = () => {
  const [resources, setResources]       = useState([]);
  const [typeFilter, setTypeFilter]     = useState('ALL');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  // Allocation form state
  const [allocTarget, setAllocTarget]   = useState(null);   // resource being allocated
  const [allocOrderId, setAllocOrderId] = useState('');
  const [allocUnits, setAllocUnits]     = useState(1);
  const [allocMsg, setAllocMsg]         = useState('');

  // Release form state
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [releaseOrderId, setReleaseOrderId] = useState('');
  const [releaseUnits, setReleaseUnits]   = useState(1);
  const [releaseMsg, setReleaseMsg]       = useState('');

  // ── Fetch resources ────────────────────────────────────────────────────────
  const fetchResources = useCallback(async () => {
    try {
      const data = await getAllResources();
      setResources(data);
      setError('');
    } catch {
      setError('Failed to load resources.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchResources();
    const interval = setInterval(fetchResources, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchResources]);

  // ── Filtered resource list ─────────────────────────────────────────────────
  const filteredResources = typeFilter === 'ALL'
    ? resources
    : resources.filter((r) => r.resource_type === typeFilter);

  // ── Allocate submit ────────────────────────────────────────────────────────
  const handleAllocateSubmit = async (e) => {
    e.preventDefault();
    setAllocMsg('');
    try {
      const result = await allocateResource({
        order_id:        parseInt(allocOrderId),
        resource_id:     allocTarget.resource_id,
        units_requested: parseInt(allocUnits),
      });
      setAllocMsg(result.granted
        ? '✅ Resources allocated successfully.'
        : `⚠️ ${result.reason}`);
      fetchResources(); // refresh availability
    } catch {
      setAllocMsg('❌ Allocation request failed.');
    }
  };

  // ── Release submit ─────────────────────────────────────────────────────────
  const handleReleaseSubmit = async (e) => {
    e.preventDefault();
    setReleaseMsg('');
    try {
      await releaseResource({
        order_id:        parseInt(releaseOrderId),
        resource_id:     releaseTarget.resource_id,
        units_to_release: parseInt(releaseUnits),
      });
      setReleaseMsg('✅ Resources released successfully.');
      fetchResources();
    } catch {
      setReleaseMsg('❌ Release request failed.');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="resource-panel" aria-label="Resource Management">

      {/* Page header */}
      <div className="resource-panel-header">
        <h1>Resource Management</h1>
        <span className="live-badge" aria-live="polite">● Live</span>
      </div>

      {/* Type filter tabs */}
      <div className="filter-tabs" role="tablist" aria-label="Filter by resource type">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={typeFilter === f}
            className={`filter-tab ${typeFilter === f ? 'active' : ''}`}
            onClick={() => setTypeFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {error   && <div className="alert alert-error" role="alert">{error}</div>}
      {loading && <p className="loading-text" aria-busy="true">Loading resources...</p>}

      {/* Resource cards grid */}
      {!loading && filteredResources.length > 0 && (
        <div className="resource-cards-grid">
          {filteredResources.map((res) => (
            <ResourceCard
              key={res.resource_id}
              resource={res}
              onAllocate={(r) => { setAllocTarget(r); setReleaseTarget(null); setAllocMsg(''); }}
              onRelease={(r)  => { setReleaseTarget(r); setAllocTarget(null); setReleaseMsg(''); }}
            />
          ))}
        </div>
      )}

      {!loading && filteredResources.length === 0 && !error && (
        <p className="empty-state">No resources of type "{typeFilter}" found.</p>
      )}

      {/* Inline Allocation form */}
      {allocTarget && (
        <div className="inline-form-panel" role="dialog" aria-modal="true"
             aria-label={`Allocate ${allocTarget.resource_name}`}>
          <h2>Allocate — {allocTarget.resource_name}</h2>
          <p>Available: <strong>{allocTarget.available_units}</strong> {allocTarget.unit_label}</p>
          <form onSubmit={handleAllocateSubmit}>
            <div className="form-group">
              <label htmlFor="alloc-order-id">Order ID</label>
              <input id="alloc-order-id" type="number" min={1}
                value={allocOrderId} onChange={(e) => setAllocOrderId(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="alloc-units">Units to Request</label>
              <input id="alloc-units" type="number" min={1}
                max={allocTarget.available_units}
                value={allocUnits} onChange={(e) => setAllocUnits(e.target.value)} required />
            </div>
            {allocMsg && <p className="form-message">{allocMsg}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Submit Request</button>
              <button type="button" className="btn btn-secondary"
                onClick={() => setAllocTarget(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Inline Release form */}
      {releaseTarget && (
        <div className="inline-form-panel" role="dialog" aria-modal="true"
             aria-label={`Release ${releaseTarget.resource_name}`}>
          <h2>Release — {releaseTarget.resource_name}</h2>
          <form onSubmit={handleReleaseSubmit}>
            <div className="form-group">
              <label htmlFor="release-order-id">Order ID</label>
              <input id="release-order-id" type="number" min={1}
                value={releaseOrderId} onChange={(e) => setReleaseOrderId(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="release-units">Units to Release</label>
              <input id="release-units" type="number" min={1}
                value={releaseUnits} onChange={(e) => setReleaseUnits(e.target.value)} required />
            </div>
            {releaseMsg && <p className="form-message">{releaseMsg}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">Release</button>
              <button type="button" className="btn btn-secondary"
                onClick={() => setReleaseTarget(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Allocation status table below the cards */}
      <AllocationStatus />

    </section>
  );
};

export default ResourcePanel;
