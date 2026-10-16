// WorkerForm.jsx
// Member: Karan Singh
// Description: Form for registering a new worker into the system.

import React, { useState } from 'react';
import { createWorker } from '../../services/machineService';

const SHIFTS = ['MORNING', 'AFTERNOON', 'NIGHT', 'FLEXIBLE'];

const INITIAL_FORM = {
  first_name:    '',
  last_name:     '',
  employee_code: '',
  skill_set:     '',
  shift:         'MORNING',
  hourly_rate:   0,
  hire_date:     '',
};

const WorkerForm = ({ onSuccess, onCancel }) => {
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
    if (!form.first_name.trim())    errs.first_name    = 'First name is required';
    if (!form.last_name.trim())     errs.last_name     = 'Last name is required';
    if (!form.employee_code.trim()) errs.employee_code = 'Employee code is required';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      const newWorker = await createWorker({
        ...form,
        hourly_rate: parseFloat(form.hourly_rate),
      });
      setForm(INITIAL_FORM);
      if (onSuccess) onSuccess(newWorker);
    } catch (err) {
      setApiError(err.response?.data?.message || 'Failed to create worker.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="worker-form-container">
      <h2>Register New Worker</h2>
      {apiError && <div className="alert alert-error" role="alert">{apiError}</div>}
      <form onSubmit={handleSubmit} noValidate className="worker-form">

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="first_name">First Name <span aria-hidden="true">*</span></label>
            <input id="first_name" type="text" name="first_name"
              value={form.first_name} onChange={handleChange}
              aria-invalid={!!errors.first_name} />
            {errors.first_name && <span className="field-error">{errors.first_name}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="last_name">Last Name <span aria-hidden="true">*</span></label>
            <input id="last_name" type="text" name="last_name"
              value={form.last_name} onChange={handleChange}
              aria-invalid={!!errors.last_name} />
            {errors.last_name && <span className="field-error">{errors.last_name}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="employee_code">Employee Code <span aria-hidden="true">*</span></label>
          <input id="employee_code" type="text" name="employee_code"
            value={form.employee_code} onChange={handleChange}
            placeholder="e.g. EMP-001"
            aria-invalid={!!errors.employee_code} />
          {errors.employee_code && <span className="field-error">{errors.employee_code}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="skill_set">Skills (comma-separated)</label>
          <input id="skill_set" type="text" name="skill_set"
            value={form.skill_set} onChange={handleChange}
            placeholder="e.g. Welding,CNC,Assembly" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="shift">Shift</label>
            <select id="shift" name="shift" value={form.shift} onChange={handleChange}>
              {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="hourly_rate">Hourly Rate (₹)</label>
            <input id="hourly_rate" type="number" name="hourly_rate"
              value={form.hourly_rate} onChange={handleChange} min={0} step={0.01} />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="hire_date">Hire Date</label>
          <input id="hire_date" type="date" name="hire_date"
            value={form.hire_date} onChange={handleChange} />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Registering...' : 'Register Worker'}
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

export default WorkerForm;
