// authService.js
// Member: Anmol Bhatt
// Description: All Axios API calls for authentication and user management.
//              Also provides token storage helpers used across the app.

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const authAPI = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request automatically
authAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global 401 handler — redirect to login if token expires
authAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────

// Login — stores token and user in localStorage on success
// @param credentials { username, password }
export const login = async (credentials) => {
  const response = await authAPI.post('/auth/login', credentials);
  const { token, user } = response.data;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  return response.data;
};

// Logout — clears localStorage and revokes server session
export const logout = async () => {
  try {
    await authAPI.post('/auth/logout');
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

// Refresh token before expiry
export const refreshToken = async () => {
  const response = await authAPI.post('/auth/refresh');
  localStorage.setItem('token', response.data.token);
  return response.data;
};

// Get the currently logged-in user profile from the server
export const getCurrentUser = async () => {
  const response = await authAPI.get('/auth/me');
  return response.data;
};

// ── User management ───────────────────────────────────────────────────────────

export const getAllUsers = async () => {
  const response = await authAPI.get('/auth/users');
  return response.data;
};

// @param data { username, email, password, full_name, role }
export const createUser = async (data) => {
  const response = await authAPI.post('/auth/users', data);
  return response.data;
};

export const updateUser = async (userId, data) => {
  const response = await authAPI.put(`/auth/users/${userId}`, data);
  return response.data;
};

export const deactivateUser = async (userId) => {
  const response = await authAPI.patch(`/auth/users/${userId}/deactivate`);
  return response.data;
};

// @param data { old_password, new_password }
export const changePassword = async (userId, data) => {
  const response = await authAPI.post(`/auth/users/${userId}/change-password`, data);
  return response.data;
};

// ── Local helpers ─────────────────────────────────────────────────────────────

// Get user object from localStorage (no API call)
export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
};

// Check if a valid token exists in localStorage
export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

// Check if stored user has a given role
export const hasRole = (role) => {
  const user = getStoredUser();
  return user?.role === role;
};

// ── Reports & History ─────────────────────────────────────────────────────────

// Get dashboard summary stats
export const getDashboardSummary = async () => {
  const response = await authAPI.get('/reports/summary');
  return response.data;
};

// Get all performance reports
export const getAllReports = async () => {
  const response = await authAPI.get('/reports');
  return response.data;
};

// Generate a new performance report
// @param data { algorithm, period_start, period_end, report_name }
export const generateReport = async (data) => {
  const response = await authAPI.post('/reports/generate', data);
  return response.data;
};

// Get production history — optional filters
export const getProductionHistory = async (filters = {}) => {
  const response = await authAPI.get('/history', { params: filters });
  return response.data;
};

// Get algorithm comparison data
export const getAlgorithmComparison = async () => {
  const response = await authAPI.get('/reports/algorithm-comparison');
  return response.data;
};

// Get audit logs — optional filters
export const getAuditLogs = async (filters = {}) => {
  const response = await authAPI.get('/audit', { params: filters });
  return response.data;
};
