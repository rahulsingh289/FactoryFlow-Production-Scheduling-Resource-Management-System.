import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Card, StatusBadge, Empty, Icon } from '../components/ui';

const EMPTY = { product_name: '', quantity: 10, arrival_time: 0, execution_time: 5, priority: 3, deadline: 20, required_machine_type: '' };
const STATUSES = ['READY', 'RUNNING', 'BLOCKED', 'COMPLETED'];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    try { setOrders(await api.get('/api/orders')); } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function addOrder(e) {
    e.preventDefault(); setErr('');
    try {
      await api.post('/api/orders', {
        ...form, quantity: +form.quantity, arrival_time: +form.arrival_time,
        execution_time: +form.execution_time, priority: +form.priority, deadline: +form.deadline,
      });
      setForm(EMPTY); setShowForm(false); load();
    } catch (e) { setErr(e.message); }
  }
  async function changeStatus(id, status) {
    try { await api.patch(`/api/orders/${id}/status`, { status }); load(); } catch (e) { setErr(e.message); }
  }
  async function remove(id) {
    if (!confirm('Delete this order?')) return;
    try { await api.del(`/api/orders/${id}`); load(); } catch (e) { setErr(e.message); }
  }

  const filtered = orders.filter((o) => o.product_name.toLowerCase().includes(search.toLowerCase()));
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="stack">
      <Card
        title="Production orders"
        desc={`${orders.length} orders · each behaves like an OS process (arrival, burst, priority, deadline)`}
        actions={
          <>
            <div className="search-box"><Icon name="search" /><input placeholder="Search product…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
              <Icon name={showForm ? 'x' : 'plus'} size={16} />{showForm ? 'Cancel' : 'New order'}
            </button>
          </>
        }
        pad={false}
      >
        <div style={{ padding: 20, paddingBottom: 0 }}>
          {err && <div className="form-error"><Icon name="alert" size={16} />{err}</div>}
          {showForm && (
            <form className="form-grid" onSubmit={addOrder}>
              <label>Product<input value={form.product_name} onChange={set('product_name')} required placeholder="e.g. Office Chair" /></label>
              <label>Quantity<input type="number" min="1" value={form.quantity} onChange={set('quantity')} /></label>
              <label>Arrival time<input type="number" min="0" value={form.arrival_time} onChange={set('arrival_time')} /></label>
              <label>Execution (burst)<input type="number" min="1" value={form.execution_time} onChange={set('execution_time')} /></label>
              <label>Priority (1 = high)
                <select value={form.priority} onChange={set('priority')}>{[1,2,3,4,5].map((p) => <option key={p} value={p}>{p}</option>)}</select>
              </label>
              <label>Deadline<input type="number" min="0" value={form.deadline} onChange={set('deadline')} /></label>
              <label>Machine type<input value={form.required_machine_type} onChange={set('required_machine_type')} placeholder="e.g. CNC Machine" /></label>
              <button className="btn btn-primary"><Icon name="check" size={16} />Create</button>
            </form>
          )}
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>ID</th><th>Product</th><th className="num">Qty</th><th className="num">Arrival</th><th className="num">Burst</th>
              <th>Priority</th><th className="num">Deadline</th><th>Machine</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.order_id}>
                  <td className="num muted">#{o.order_id}</td>
                  <td><b>{o.product_name}</b></td>
                  <td className="num">{o.quantity}</td>
                  <td className="num">{o.arrival_time}</td>
                  <td className="num">{o.execution_time}</td>
                  <td><span className={`prio prio-${o.priority}`}>P{o.priority}</span></td>
                  <td className="num">{o.deadline}</td>
                  <td className="muted">{o.required_machine_type || '—'}</td>
                  <td>
                    <select className="status-select" value={o.status} onChange={(e) => changeStatus(o.order_id, e.target.value)}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><button className="btn btn-ghost btn-sm btn-danger" onClick={() => remove(o.order_id)}><Icon name="trash" size={15} /></button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="10"><Empty icon="orders">No orders match your search.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
