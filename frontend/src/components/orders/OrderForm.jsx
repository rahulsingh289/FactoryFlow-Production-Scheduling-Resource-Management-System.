// OrderForm.jsx
// Member: Aman Singh Rawat
// Description: Form component for creating a new production order.
//              Validates all fields on the client side before submitting
//              to the backend via orderService.

import React, { useState } from 'react';
import { createOrder } from '../../services/orderService';

// Priority labels shown in the dropdown (1 = Critical, 10 = Low)
const PRIORITY_OPTIONS = [
  { value: 1, label: '1 — Critical' },
  { value: 2, label: '2 — Very High' },
  { value: 3, label: '3 — High' },
  { value: 4, label: '4 — Above Normal' },
  { value: 5, label: '5 — Normal' },
  { value: 6, label: '6 — Below Normal' },
  { value: 7, label: '7 — Low' },
  { value: 8, label: '8 — Very Low' },
  { value: 9, label: '9 — Minimal' },
  { value: 10, label: '10 — Idle' },
];

const INITIAL_FORM = {
  order_name: '',
  product_name: '',
  quantity: 1,
  priority: 5,
  execution_time: '',
  deadline: '',
};

// Props:
//   onSuccess(newOrder) — called after successful creation
//   onCancel()          — called when user clicks Cancel
const OrderForm = ({ onSuccess, onCancel }) => {
  const [form, setForm]       = useState(INITIAL_FORM);
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // ── Field change handler ──────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field-level error on change
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  // ── Client-side validation ────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};
    if (!form.order_name.trim())
      newErrors.order_name = 'Order name is required';
    if (!form.product_name.trim())
      newErrors.product_name = 'Product name is required';
    if (!form.quantity || form.quantity < 1)
      newErrors.quantity = 'Quantity must be at least 1';
    if (!form.execution_time || form.execution_time < 1)
      newErrors.execution_time = 'Execution time (minutes) is required';
    if (!form.deadline)
      newErrors.deadline = 'Deadline is required';
    else if (new Date(form.deadline) <= new Date())
      newErrors.deadline = 'Deadline must be in the future';
    return newErrors;
  };

  // ── Form submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const newOrder = await createOrder({
        ...form,
        quantity: parseInt(form.quantity),
        priority: parseInt(form.priority),
        execution_time: parseInt(form.execution_time),
      });
      setForm(INITIAL_FORM);
      if (onSuccess) onSuccess(newOrder);
    } catch (err) {
      setApiError(err.response?.data?.message || 'Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="order-form-container">
      <h2 className="order-form-title">Create New Production Order</h2>

      {apiError && (
        <div className="alert alert-error" role="alert">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="order-form">

        {/* Order Name */}
        <div className="form-group">
          <label htmlFor="order_name">Order Name <span aria-hidden="true">*</span></label>
          <input
            id="order_name"
            type="text"
            name="order_name"
            value={form.order_name}
            onChange={handleChange}
            placeholder="e.g. Batch-001"
            aria-describedby={errors.order_name ? 'order_name_error' : undefined}
            aria-invalid={!!errors.order_name}
          />
          {errors.order_name && (
            <span id="order_name_error" className="field-error">{errors.order_name}</span>
          )}
        </div>

        {/* Product Name */}
        <div className="form-group">
          <label htmlFor="product_name">Product Name <span aria-hidden="true">*</span></label>
          <input
            id="product_name"
            type="text"
            name="product_name"
            value={form.product_name}
            onChange={handleChange}
            placeholder="e.g. Steel Gear Type-A"
            aria-describedby={errors.product_name ? 'product_name_error' : undefined}
            aria-invalid={!!errors.product_name}
          />
          {errors.product_name && (
            <span id="product_name_error" className="field-error">{errors.product_name}</span>
          )}
        </div>

        {/* Quantity */}
        <div className="form-group">
          <label htmlFor="quantity">Quantity <span aria-hidden="true">*</span></label>
          <input
            id="quantity"
            type="number"
            name="quantity"
            value={form.quantity}
            onChange={handleChange}
            min={1}
            aria-describedby={errors.quantity ? 'quantity_error' : undefined}
            aria-invalid={!!errors.quantity}
          />
          {errors.quantity && (
            <span id="quantity_error" className="field-error">{errors.quantity}</span>
          )}
        </div>

        {/* Priority */}
        <div className="form-group">
          <label htmlFor="priority">Priority</label>
          <select
            id="priority"
            name="priority"
            value={form.priority}
            onChange={handleChange}
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Execution Time */}
        <div className="form-group">
          <label htmlFor="execution_time">Execution Time (minutes) <span aria-hidden="true">*</span></label>
          <input
            id="execution_time"
            type="number"
            name="execution_time"
            value={form.execution_time}
            onChange={handleChange}
            min={1}
            placeholder="e.g. 120"
            aria-describedby={errors.execution_time ? 'exec_time_error' : undefined}
            aria-invalid={!!errors.execution_time}
          />
          {errors.execution_time && (
            <span id="exec_time_error" className="field-error">{errors.execution_time}</span>
          )}
        </div>

        {/* Deadline */}
        <div className="form-group">
          <label htmlFor="deadline">Deadline <span aria-hidden="true">*</span></label>
          <input
            id="deadline"
            type="datetime-local"
            name="deadline"
            value={form.deadline}
            onChange={handleChange}
            aria-describedby={errors.deadline ? 'deadline_error' : undefined}
            aria-invalid={!!errors.deadline}
          />
          {errors.deadline && (
            <span id="deadline_error" className="field-error">{errors.deadline}</span>
          )}
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Order'}
          </button>
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>

      </form>
    </div>
  );
};

export default OrderForm;
