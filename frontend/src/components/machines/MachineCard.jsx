// MachineCard.jsx
// Member: Karan Singh
// Description: Displays one machine as a card with status badge,
//              type, location, and quick-action buttons.

import React from 'react';

// Status badge colour mapping
const STATUS_BADGE = {
  IDLE:        'badge-green',
  BUSY:        'badge-blue',
  MAINTENANCE: 'badge-yellow',
  OFFLINE:     'badge-red',
};

// Status icon
const STATUS_ICON = {
  IDLE:        '✅',
  BUSY:        '⚙️',
  MAINTENANCE: '🔧',
  OFFLINE:     '🔴',
};

// Props:
//   machine        — machine object from API
//   onStatusChange(machine, newStatus) — quick status update
//   onViewMaintenance(machine)         — opens maintenance log
const MachineCard = ({ machine, onStatusChange, onViewMaintenance }) => {
  const badgeClass = STATUS_BADGE[machine.status] || 'badge-gray';
  const icon       = STATUS_ICON[machine.status]  || '⚙️';

  return (
    <article className="machine-card" aria-label={`Machine ${machine.machine_name}`}>

      {/* Header: name + status badge */}
      <div className="machine-card-header">
        <span className="machine-icon" aria-hidden="true">{icon}</span>
        <div>
          <h3 className="machine-card-title">{machine.machine_name}</h3>
          <span className={`badge ${badgeClass}`}>{machine.status}</span>
        </div>
      </div>

      {/* Body: key details */}
      <div className="machine-card-body">
        <p><strong>Type:</strong> {machine.machine_type}</p>
        <p><strong>Location:</strong> {machine.location || '—'}</p>
        <p><strong>Capacity:</strong> {machine.capacity_per_hr} units/hr</p>
        {machine.current_order_id > 0 && (
          <p><strong>Current Order:</strong> #{machine.current_order_id}</p>
        )}
        {machine.next_service_due && (
          <p><strong>Next Service:</strong> {new Date(machine.next_service_due).toLocaleDateString()}</p>
        )}
      </div>

      {/* Quick status change buttons */}
      <div className="machine-card-status-actions">
        {['IDLE', 'MAINTENANCE', 'OFFLINE'].map((s) => (
          machine.status !== s && (
            <button
              key={s}
              className="btn btn-xs btn-outline"
              onClick={() => onStatusChange && onStatusChange(machine, s)}
              aria-label={`Set ${machine.machine_name} to ${s}`}
            >
              {s}
            </button>
          )
        ))}
      </div>

      {/* Footer: maintenance log button */}
      <div className="machine-card-footer">
        <button
          className="btn btn-sm btn-outline"
          onClick={() => onViewMaintenance && onViewMaintenance(machine)}
          aria-label={`View maintenance log for ${machine.machine_name}`}
        >
          Maintenance Log
        </button>
      </div>

    </article>
  );
};

export default MachineCard;
