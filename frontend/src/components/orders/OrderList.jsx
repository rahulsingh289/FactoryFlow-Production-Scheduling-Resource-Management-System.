// OrderList.jsx
// Member: Aman Singh Rawat
// Description: Fetches and displays all production orders in a filterable,
//              paginated list. Hosts OrderCard for each item.
//              Also provides a button to open OrderForm for creating new orders.

import React, { useState, useEffect, useCallback } from 'react';
import OrderCard from './OrderCard';
import OrderForm from './OrderForm';
import { getAllOrders, deleteOrder } from '../../services/orderService';

// State filter tabs shown at the top of the list
const STATE_FILTERS = ['ALL', 'NEW', 'READY', 'RUNNING', 'WAITING', 'COMPLETED', 'TERMINATED'];

const OrderList = () => {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [showForm, setShowForm]       = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // ── Fetch orders from API ─────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filter = activeFilter === 'ALL' ? '' : activeFilter;
      const data = await getAllOrders(filter);
      setOrders(data);
    } catch (err) {
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  // Re-fetch whenever the state filter changes
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Terminate handler ─────────────────────────────────────────────────────
  const handleTerminate = async (orderId) => {
    if (!window.confirm('Are you sure you want to terminate this order?')) return;
    try {
      await deleteOrder(orderId);
      // Optimistically remove from local state
      setOrders((prev) => prev.filter((o) => o.order_id !== orderId));
    } catch {
      setError('Failed to terminate order.');
    }
  };

  // ── After new order created ───────────────────────────────────────────────
  const handleOrderCreated = (newOrder) => {
    setShowForm(false);
    setOrders((prev) => [newOrder, ...prev]); // add to top of list
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="order-list-container" aria-label="Production Orders">

      {/* Page header */}
      <div className="order-list-header">
        <h1>Production Orders</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm((prev) => !prev)}
          aria-expanded={showForm}
        >
          {showForm ? 'Cancel' : '+ New Order'}
        </button>
      </div>

      {/* Inline order creation form (toggle) */}
      {showForm && (
        <OrderForm
          onSuccess={handleOrderCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* State filter tabs */}
      <div className="filter-tabs" role="tablist" aria-label="Filter orders by state">
        {STATE_FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={activeFilter === f}
            className={`filter-tab ${activeFilter === f ? 'active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="alert alert-error" role="alert">{error}</div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="loading-spinner" aria-live="polite" aria-busy="true">
          Loading orders...
        </div>
      )}

      {/* Empty state */}
      {!loading && orders.length === 0 && !error && (
        <div className="empty-state">
          <p>No production orders found{activeFilter !== 'ALL' ? ` with state "${activeFilter}"` : ''}.</p>
        </div>
      )}

      {/* Order cards grid */}
      {!loading && orders.length > 0 && (
        <div className="order-cards-grid">
          {orders.map((order) => (
            <OrderCard
              key={order.order_id}
              order={order}
              onView={setSelectedOrder}
              onTerminate={handleTerminate}
            />
          ))}
        </div>
      )}

      {/* Selected order detail panel */}
      {selectedOrder && (
        <div className="order-detail-panel" role="dialog" aria-modal="true" aria-label="Order Details">
          <div className="panel-header">
            <h2>Order Details — {selectedOrder.order_name}</h2>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setSelectedOrder(null)}
              aria-label="Close order details"
            >
              Close
            </button>
          </div>
          <pre className="order-detail-json">
            {JSON.stringify(selectedOrder, null, 2)}
          </pre>
        </div>
      )}

    </section>
  );
};

export default OrderList;
