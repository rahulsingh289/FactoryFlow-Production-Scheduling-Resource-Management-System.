// ResourceCard.jsx
// Member: Rahul Singh
// Description: Displays one resource as a card with a live availability
//              progress bar showing used vs total units.

import React from 'react';

// Maps resource_type to an icon label
const TYPE_ICON = {
  MACHINE:  '⚙️',
  ROBOT:    '🤖',
  MATERIAL: '📦',
  WORKER:   '👷',
};

// Props:
//   resource  — resource object from the API
//   onAllocate(resource) — opens allocation form for this resource
//   onRelease(resource)  — opens release form for this resource
const ResourceCard = ({ resource, onAllocate, onRelease }) => {
  const usedUnits  = resource.total_units - resource.available_units;
  const usagePct   = Math.round((usedUnits / resource.total_units) * 100);
  const icon       = TYPE_ICON[resource.resource_type] || '🔧';

  // Colour the bar: green < 60%, yellow 60–85%, red > 85%
  const barColor =
    usagePct > 85 ? 'bar-red' :
    usagePct > 60 ? 'bar-yellow' :
    'bar-green';

  return (
    <article className="resource-card" aria-label={`Resource ${resource.resource_name}`}>

      {/* Header */}
      <div className="resource-card-header">
        <span className="resource-icon" aria-hidden="true">{icon}</span>
        <div>
          <h3 className="resource-card-title">{resource.resource_name}</h3>
          <span className="resource-type-badge">{resource.resource_type}</span>
        </div>
      </div>

      {/* Availability bar */}
      <div className="resource-availability">
        <div className="availability-labels">
          <span>{resource.available_units} free</span>
          <span>{resource.total_units} total</span>
        </div>
        <div
          className="availability-bar-track"
          role="progressbar"
          aria-valuenow={usagePct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${usagePct}% of ${resource.resource_name} in use`}
        >
          <div
            className={`availability-bar-fill ${barColor}`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        <p className="availability-pct">{usagePct}% in use</p>
      </div>

      {/* Description */}
      {resource.description && (
        <p className="resource-description">{resource.description}</p>
      )}

      {/* Actions */}
      <div className="resource-card-footer">
        <button
          className="btn btn-sm btn-primary"
          onClick={() => onAllocate && onAllocate(resource)}
          disabled={resource.available_units === 0}
          aria-label={`Allocate ${resource.resource_name}`}
        >
          Allocate
        </button>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => onRelease && onRelease(resource)}
          disabled={usedUnits === 0}
          aria-label={`Release ${resource.resource_name}`}
        >
          Release
        </button>
      </div>

    </article>
  );
};

export default ResourceCard;
