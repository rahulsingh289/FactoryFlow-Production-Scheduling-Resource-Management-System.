// resourceService.js
// Member: Rahul Singh
// Description: All Axios API calls related to resources, allocations,
//              and deadlock detection. Imported by resource UI components.

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const resourceAPI = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
resourceAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Resource CRUD ─────────────────────────────────────────────────────────────

// Get all resources with current availability
export const getAllResources = async () => {
  const response = await resourceAPI.get('/resources');
  return response.data;
};

// Get one resource by ID
export const getResourceById = async (resourceId) => {
  const response = await resourceAPI.get(`/resources/${resourceId}`);
  return response.data;
};

// Register a new resource
// @param data { resource_name, resource_type, total_units, unit_label, description }
export const createResource = async (data) => {
  const response = await resourceAPI.post('/resources', data);
  return response.data;
};

// Update a resource
export const updateResource = async (resourceId, data) => {
  const response = await resourceAPI.put(`/resources/${resourceId}`, data);
  return response.data;
};

// Delete a resource (only if fully available — nothing allocated)
export const deleteResource = async (resourceId) => {
  const response = await resourceAPI.delete(`/resources/${resourceId}`);
  return response.data;
};

// ── Allocation operations ─────────────────────────────────────────────────────

// Request resource allocation for an order (triggers Banker's Algorithm check)
// @param data { order_id, resource_id, units_requested }
export const allocateResource = async (data) => {
  const response = await resourceAPI.post('/resources/allocate', data);
  return response.data;
};

// Release specific resource units back to the pool
// @param data { order_id, resource_id, units_to_release }
export const releaseResource = async (data) => {
  const response = await resourceAPI.post('/resources/release', data);
  return response.data;
};

// Release ALL resources held by a given order
// @param orderId
export const releaseAllResources = async (orderId) => {
  const response = await resourceAPI.post('/resources/release-all', { order_id: orderId });
  return response.data;
};

// Get allocation records — optional filters
// @param filters { order_id, resource_id, state }
export const getAllocations = async (filters = {}) => {
  const response = await resourceAPI.get('/resources/allocations', { params: filters });
  return response.data;
};

// ── Deadlock ──────────────────────────────────────────────────────────────────

// Run deadlock detection on all active processes
export const checkDeadlock = async () => {
  const response = await resourceAPI.get('/deadlock/check');
  return response.data;
};

// Trigger deadlock resolution (terminates lowest-priority deadlocked process)
export const resolveDeadlock = async () => {
  const response = await resourceAPI.post('/deadlock/resolve');
  return response.data;
};
