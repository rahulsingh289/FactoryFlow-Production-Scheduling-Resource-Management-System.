// ScheduleView.jsx
// Member: Aman Singh Rawat
// Description: Displays the current production schedule produced by the OS
//              Scheduling Engine. Lets the manager pick an algorithm and
//              trigger a scheduling run.

import React, { useState, useEffect } from 'react';
import { getSchedule, runScheduler } from '../../services/orderService';

const ALGORITHMS = ['FCFS', 'SJF', 'PRIORITY'];

const ScheduleView = () => {
  const [schedule, setSchedule]       = useState([]);
  const [algorithm, setAlgorithm]     = useState('FCFS');
  const [loading, setLoading]         = useState(false);
  const [running, setRunning]         = useState(false);
  const [message, setMessage]         = useState('');
  const [error, setError]             = useState('');

  // Fetch schedule on mount
  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      try {
        const data = await getSchedule();
        setSchedule(data);
      } catch {
        setError('Failed to load schedule.');
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, []);

  // Trigger the OS Scheduling Engine
  const handleRunScheduler = async () => {
    setRunning(true);
    setMessage('');
    setError('');
    try {
      const result = await runScheduler(algorithm);
      setMessage(result.message || 'Scheduler ran successfully.');
      // Refresh schedule after run
      const updated = await getSchedule();
      setSchedule(updated);
    } catch {
      setError('Failed to run scheduler.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="schedule-view" aria-label="Production Schedule">
      <div className="schedule-header">
        <h1>Production Schedule</h1>

        {/* Algorithm selector + run button */}
        <div className="schedule-controls">
          <label htmlFor="algo-select">Algorithm:</label>
          <select
            id="algo-select"
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value)}
          >
            {ALGORITHMS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={handleRunScheduler}
            disabled={running}
          >
            {running ? 'Running...' : 'Run Scheduler'}
          </button>
        </div>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error   && <div className="alert alert-error">{error}</div>}

      {loading && <p className="loading-text">Loading schedule...</p>}

      {/* Schedule table */}
      {!loading && schedule.length > 0 && (
        <table className="schedule-table" aria-label="Schedule table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Order Name</th>
              <th scope="col">Product</th>
              <th scope="col">Priority</th>
              <th scope="col">Exec Time (min)</th>
              <th scope="col">State</th>
              <th scope="col">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((order, index) => (
              <tr key={order.order_id}>
                <td>{index + 1}</td>
                <td>{order.order_name}</td>
                <td>{order.product_name}</td>
                <td>{order.priority}</td>
                <td>{order.execution_time}</td>
                <td><span className="badge">{order.process_state}</span></td>
                <td>{new Date(order.deadline).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && schedule.length === 0 && !error && (
        <p className="empty-state">No schedule available. Run the scheduler to generate one.</p>
      )}
    </section>
  );
};

export default ScheduleView;
