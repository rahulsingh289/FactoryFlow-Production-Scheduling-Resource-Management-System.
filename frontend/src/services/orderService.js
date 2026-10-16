// orderService.js
// Member: Aman Singh Rawat
// Description: All Axios API calls related to production orders.
//              Every component that needs order data imports from here — 
//              keeps API logic out of UI components.

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const orderAPI = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request automatically
orderAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Order CRUD ────────────────────────────────────────────────────────────────

// Create a new production order
// @param orderData { order_name, product_name, quantity, priority, execution_time, deadline }
export const createOrder = async (orderData) => {
  const response = await orderAPI.post('/orders', orderData);
  return response.data;
};

// Get all orders — optional stateFilter: 'NEW' | 'READY' | 'RUNNING' | etc.
export const getAllOrders = async (stateFilter = '') => {
  const params = stateFilter ? { state: stateFilter } : {};
  const response = await orderAPI.get('/orders', { params });
  return response.data;
};

// Get a single order by ID
export const getOrderById = async (orderId) => {
  const response = await orderAPI.get(`/orders/${orderId}`);
  return response.data;
};

// Update an existing order (only NEW or READY state orders)
export const updateOrder = async (orderId, updateData) => {
  const response = await orderAPI.put(`/orders/${orderId}`, updateData);
  return response.data;
};

// Terminate / cancel an order
export const deleteOrder = async (orderId) => {
  const response = await orderAPI.delete(`/orders/${orderId}`);
  return response.data;
};

// ── Scheduling ────────────────────────────────────────────────────────────────

// Trigger the OS Scheduling Engine
// @param algorithm: 'FCFS' | 'SJF' | 'PRIORITY'
export const runScheduler = async (algorithm = 'FCFS') => {
  const response = await orderAPI.post('/orders/schedule/run', { algorithm });
  return response.data;
};

// Get the current active schedule
export const getSchedule = async () => {
  const response = await orderAPI.get('/orders/schedule');
  return response.data;
};

// Get the current ready queue snapshot
export const getQueue = async () => {
  const response = await orderAPI.get('/orders/queue');
  return response.data;
};
