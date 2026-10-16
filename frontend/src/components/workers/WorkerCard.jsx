// WorkerCard.jsx
// Member: Karan Singh
// Description: Displays one worker as a card with status badge, skills,
//              shift, and quick status change buttons.

import React from 'react';

const STATUS_BADGE = {
  AVAILABLE: 'badge-green',
  ASSIGNED:  'badge-blue',
  ON_LEAVE:  'badge-yellow',
  INACTIVE:  'badge-red',
};

const SHIFT_ICON = {
  MORNING:   '🌅',
  AFTERNOON: '☀️',
  NIGHT:     '🌙',
  FLEXIBLE:  '🔄',
};

// Props:
//   worker          — worker object from API
//   onStatusChange(worker, newStatus)
const WorkerCard = ({ worker, onStatusChange }) => {
  const badgeClass  = STATUS_BADGE[worker.status]  || 'badge-gray';
  const shiftIcon   = SHIFT_ICON[worker.shift]     || '👷';

  // Parse comma-separated skills into chips
  const skills = worker.skill_set
    ? worker.skill_set.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <article className="worker-card" aria-label={`Worker ${worker.first_name} ${worker.last_name}`}>

      {/* Header */}
      <div className="worker-card-header">
        <div className="worker-avatar" aria-hidden="true">
          {worker.first_name?.[0]}{worker.last_name?.[0]}
        </div>
        <div>
          <h3 className="worker-card-title">
            {worker.first_name} {worker.last_name}
          </h3>
          <span className="worker-code">{worker.employee_code}</span>
        </div>
        <span className={`badge ${badgeClass}`}>{worker.status}</span>
      </div>

      {/* Body */}
      <div className="worker-card-body">
        <p>
          <span aria-hidden="true">{shiftIcon}</span>
          <strong> Shift:</strong> {worker.shift}
        </p>
        {worker.current_order_id > 0 && (
          <p><strong>Current Order:</strong> #{worker.current_order_id}</p>
        )}
        <p><strong>Rate:</strong> ₹{worker.hourly_rate}/hr</p>

        {/* Skill chips */}
        {skills.length > 0 && (
          <div className="skill-chips" aria-label="Skills">
            {skills.map((skill) => (
              <span key={skill} className="skill-chip">{skill}</span>
            ))}
          </div>
        )}
      </div>

      {/* Quick status actions */}
      <div className="worker-card-footer">
        {worker.status !== 'AVAILABLE' && (
          <button className="btn btn-xs btn-outline"
            onClick={() => onStatusChange && onStatusChange(worker, 'AVAILABLE')}
            aria-label={`Set ${worker.first_name} to Available`}>
            Set Available
          </button>
        )}
        {worker.status !== 'ON_LEAVE' && worker.status !== 'INACTIVE' && (
          <button className="btn btn-xs btn-outline"
            onClick={() => onStatusChange && onStatusChange(worker, 'ON_LEAVE')}
            aria-label={`Set ${worker.first_name} On Leave`}>
            On Leave
          </button>
        )}
      </div>

    </article>
  );
};

export default WorkerCard;
