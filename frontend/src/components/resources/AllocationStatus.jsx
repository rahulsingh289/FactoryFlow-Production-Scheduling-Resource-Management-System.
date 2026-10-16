// AllocationStatus.jsx
// Member: Rahul Singh
// Description: Displays a live table of all current resource allocation
//              records — which order holds which resource, how many units,
//              and the allocation state.

import React, { useState, useEffect } from 'react';
import { getAllocations } from '../../services/resourceService';

// Badge colour per allocation state
const STATE_BADGE = {
  REQUESTED: 'badge-blue',
  ALLOCATED: 'badge-green',
  RELEASED:  'badge-gray',
  DENIED:    'badge-red',
};

const AllocationStatus = () => {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [stateFilter, setStateFilter] = useState('ALLOCATED');

  useEffect(() => {
    const fetchAllocations = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getAllocations(
          stateFilter !== 'ALL' ? { state: stateFilter } : {}
        );
        setAllocations(data);
      } catch {
        setError('Failed to load allocation records.');
      } finally {
        setLoading(false);
      }
    };
    fetchAllocations();
  }, [stateFilter]);

  return (
    <section className="allocation-status" aria-label="Allocation Status">
      <div className="allocation-status-header">
        <h2>Allocation Records</h2>

        {/* State filter for the table */}
        <div className="allocation-filter">
          <label htmlFor="alloc-state-filter">Show:</label>
          <select
            id="alloc-state-filter"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          >
            <option value="ALL">All</option>
            <option value="REQUESTED">Requested</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="RELEASED">Released</option>
            <option value="DENIED">Denied</option>
          </select>
        </div>
      </div>

      {error   && <div className="alert alert-error" role="alert">{error}</div>}
      {loading && <p className="loading-text" aria-busy="true">Loading...</p>}

      {!loading && allocations.length === 0 && !error && (
        <p className="empty-state">No allocation records found.</p>
      )}

      {!loading && allocations.length > 0 && (
        <table className="allocation-table" aria-label="Resource allocation records">
          <thead>
            <tr>
              <th scope="col">Order ID</th>
              <th scope="col">Resource ID</th>
              <th scope="col">Units Requested</th>
              <th scope="col">Units Allocated</th>
              <th scope="col">State</th>
              <th scope="col">Requested At</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((alloc, index) => (
              <tr key={index}>
                <td>{alloc.order_id}</td>
                <td>{alloc.resource_id}</td>
                <td>{alloc.units_requested}</td>
                <td>{alloc.units_allocated ?? '—'}</td>
                <td>
                  <span className={`badge ${STATE_BADGE[alloc.allocation_state] || 'badge-gray'}`}>
                    {alloc.allocation_state}
                  </span>
                </td>
                <td>{alloc.requested_at
                  ? new Date(alloc.requested_at).toLocaleString()
                  : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

export default AllocationStatus;
