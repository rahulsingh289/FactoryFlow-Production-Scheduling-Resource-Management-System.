// machineService.js
// Member: Karan Singh
// Description: All Axios API calls for machines, workers, and inventory.
//              Imported by machine/worker/inventory UI components.

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Machines ──────────────────────────────────────────────────────────────────

// Get all machines — optional filters: { status, type }
export const getAllMachines = async (filters = {}) => {
  const response = await api.get('/machines', { params: filters });
  return response.data;
};

export const getMachineById = async (id) => {
  const response = await api.get(`/machines/${id}`);
  return response.data;
};

// @param data { machine_name, machine_type, location, capacity_per_hr, purchased_on }
export const createMachine = async (data) => {
  const response = await api.post('/machines', data);
  return response.data;
};

export const updateMachine = async (id, data) => {
  const response = await api.put(`/machines/${id}`, data);
  return response.data;
};

export const deleteMachine = async (id) => {
  const response = await api.delete(`/machines/${id}`);
  return response.data;
};

// Quick status change: status = 'IDLE' | 'BUSY' | 'MAINTENANCE' | 'OFFLINE'
export const updateMachineStatus = async (id, status) => {
  const response = await api.patch(`/machines/${id}/status`, { status });
  return response.data;
};

export const getMachineSummary = async () => {
  const response = await api.get('/machines/summary');
  return response.data;
};

export const getMaintenanceRecords = async (machineId) => {
  const response = await api.get(`/machines/${machineId}/maintenance`);
  return response.data;
};

// @param data { maintenance_type, description, performed_by, started_at, cost }
export const logMaintenance = async (machineId, data) => {
  const response = await api.post(`/machines/${machineId}/maintenance`, data);
  return response.data;
};

// ── Workers ───────────────────────────────────────────────────────────────────

// Get all workers — optional filters: { status, shift, skill }
export const getAllWorkers = async (filters = {}) => {
  const response = await api.get('/workers', { params: filters });
  return response.data;
};

export const getWorkerById = async (id) => {
  const response = await api.get(`/workers/${id}`);
  return response.data;
};

// @param data { first_name, last_name, employee_code, skill_set, shift, hourly_rate, hire_date }
export const createWorker = async (data) => {
  const response = await api.post('/workers', data);
  return response.data;
};

export const updateWorker = async (id, data) => {
  const response = await api.put(`/workers/${id}`, data);
  return response.data;
};

export const deleteWorker = async (id) => {
  const response = await api.delete(`/workers/${id}`);
  return response.data;
};

export const updateWorkerStatus = async (id, status) => {
  const response = await api.patch(`/workers/${id}/status`, { status });
  return response.data;
};

// @param data { worker_id, order_id, step_id }
export const assignWorker = async (data) => {
  const response = await api.post('/workers/assign', data);
  return response.data;
};

// @param data { worker_id, order_id }
export const releaseWorker = async (data) => {
  const response = await api.post('/workers/release', data);
  return response.data;
};

export const getWorkerSummary = async () => {
  const response = await api.get('/workers/summary');
  return response.data;
};

// ── Inventory ─────────────────────────────────────────────────────────────────

export const getAllInventory = async (filters = {}) => {
  const response = await api.get('/inventory', { params: filters });
  return response.data;
};

export const getLowStockItems = async () => {
  const response = await api.get('/inventory/low-stock');
  return response.data;
};

// @param data { quantity, order_id, notes }
export const consumeStock = async (itemId, data) => {
  const response = await api.post(`/inventory/${itemId}/consume`, data);
  return response.data;
};

// @param data { quantity, notes }
export const restockItem = async (itemId, data) => {
  const response = await api.post(`/inventory/${itemId}/restock`, data);
  return response.data;
};
