// MachineForm.jsx
// Member: Karan Singh
// Description: Form for registering a new machine into the system.
//              Validates required fields before POSTing to /api/machines.

import React, { useState } from 'react';
import { createMachine } from '../../services/machineService';

const MACHINE_TYPES = ['CNC', 'Lathe', 'Welding', 'Assembly', 'Painting', 'Cutting', 'Other'];

const INITIAL_FORM = {
  machine_name:    '',
  machine_type:    'CNC',
  location:        '',
  capacity_per_hr: 1,
  purchased_on:    '',
};

const MachineForm = ({ onSuccess, onCancel }) => {
  const [form, setForm]         = useState(INITIAL_FORM);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.machine_name.trim()) errs.machine_name = 'Machine name is required';
    if (!form.machine_type)        errs.machine_type = 'Machine type is required';
    if (form.capacity_per_hr < 1)  errs.capacity_per_hr = 'Capacity must be at least 1';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      const newMachine = await createMachine({
        ...form,
        capacity_per_hr: parseInt(form.capacity_per_hr),
      });
      setForm(INITIAL_FORM);
      if (onSuccess) onSuccess(newMachine);
    } catch (err) {
      setApiError(err.response?.data?.message || 'Failed to create machine.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="machine-form-container">
      <h2>Register New Machine</h2>
      {apiError && <div className="alert alert-error" role="alert">{apiError}</div>}
      <form onSubmit={handleSubmit} noValidate className="machine-form">

        <div className="form-group">
          <label htmlFor="machine_name">Machine Name <span aria-hidden="true">*</span></label>
          <input id="machine_name" type="text" name="machine_name"
            value={form.machine_name} onChange={handleChange}
            placeholder="e.g. CNC-01"
            aria-invalid={!!errors.machine_name} />
          {errors.machine_name && <span className="field-error">{errors.machine_name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="machine_type">Type <span aria-hidden="true">*</span></label>
          <select id="machine_type" name="machine_type"
            value={form.machine_type} onChange={handleChange}>
            {MACHINE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="location">Location</label>
          <input id="location" type="text" name="location"
            value={form.location} onChange={handleChange}
            placeholder="e.g. Bay A" />
        </div>

        <div className="form-group">
          <label htmlFor="capacity_per_hr">Capacity (units/hr) <span aria-hidden="true">*</span></label>
          <input id="capacity_per_hr" type="number" name="capacity_per_hr"
            value={form.capacity_per_hr} onChange={handleChange} min={1}
            aria-invalid={!!errors.capacity_per_hr} />
          {errors.capacity_per_hr && <span className="field-error">{errors.capacity_per_hr}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="purchased_on">Purchased On</label>
          <input id="purchased_on" type="date" name="purchased_on"
            value={form.purchased_on} onChange={handleChange} />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Registering...' : 'Register Machine'}
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

export default MachineForm;
