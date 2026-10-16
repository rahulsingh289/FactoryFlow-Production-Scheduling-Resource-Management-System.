// OrderCard.jsx
// Member: Aman Singh Rawat
// Description: Displays a single production order as a card.
//              Shows key fields and a colour-coded state badge.
//              Used inside OrderList.

import React from 'react';

// Maps each process state to a CSS class for colour coding
const STATE_BADGE_CLASS = {
  NEW:        'badge-gray',
  READY:      'badge-blue',
  RUNNING:    'badge-green',
  WAITING:    'badge-yellow',
  COMPLETED:  'badge-teal',
  TERMINATED: 'badge-red',
};

// Props:
//   order  — the order object from the API
//   onView(order)    — called when user clicks View Details
//   onTerminate(id)  — called when user clicks Terminate
const OrderCard = ({ order, onView, onTerminate }) => {
  const badgeClass = STATE_BADGE_CLASS[order.process_state] || 'badge-gray';

  return (
    <article className="order-card" aria-label={`Order ${order.order_name}`}>

      {/* Header row: name + state badge */}
      <div className="order-card-header">
        <h3 className="order-card-title">{order.order_name}</h3>
        <span className={`badge ${badgeClass}`}>{order.process_state}</span>
      </div>

      {/* Body: key fields */}
      <div className="order-card-body">
        <p><strong>Product:</strong> {order.product_name}</p>
        <p><strong>Quantity:</strong> {order.quantity}</p>
        <p><strong>Priority:</strong> {order.priority}</p>
        <p><strong>Exec Time:</strong> {order.execution_time} min</p>
        <p><strong>Deadline:</strong> {new Date(order.deadline).toLocaleString()}</p>
      </div>

      {/* Footer: action buttons */}
      <div className="order-card-footer">
        <button
          className="btn btn-sm btn-outline"
          onClick={() => onView && onView(order)}
          aria-label={`View details for ${order.order_name}`}
        >
          View Details
        </button>

        {/* Only show Terminate if order is not already done/terminated */}
        {order.process_state !== 'COMPLETED' && order.process_state !== 'TERMINATED' && (
          <button
            className="btn btn-sm btn-danger"
            onClick={() => onTerminate && onTerminate(order.order_id)}
            aria-label={`Terminate order ${order.order_name}`}
          >
            Terminate
          </button>
        )}
      </div>

    </article>
  );
};

export default OrderCard;
