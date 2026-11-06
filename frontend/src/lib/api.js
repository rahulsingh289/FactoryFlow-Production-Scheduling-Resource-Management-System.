// Thin fetch wrapper. Stores the JWT in localStorage and attaches it to every
// request. All URLs are relative — Vite proxies /api to the backend (:4000).

const TOKEN_KEY = 'sf_token';
const USER_KEY = 'sf_user';

// The scheduling policies the API accepts.
export const ALGORITHMS = [
  { id: 'FCFS', name: 'First Come First Served' },
  { id: 'SJF', name: 'Shortest Job First' },
  { id: 'SRTF', name: 'Shortest Remaining Time (preemptive)' },
  { id: 'PRIORITY', name: 'Priority (non-preemptive)' },
  { id: 'PRIORITYP', name: 'Priority (preemptive)' },
  { id: 'RR', name: 'Round Robin' },
];

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}
// Managers can change the factory; view-only accounts (OPERATOR) can look and run orders.
export const isManager = () => getUser()?.role === 'MANAGER';
export function setSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* ignore storage errors (private mode) */ }
}
export function clearSession() {
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch { /* ignore storage errors */ }
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),   // never wait for ever
    });
  } catch (e) {
    throw new Error(e.name === 'TimeoutError' ? 'The server took too long to answer. Please try again.' : 'Could not reach the server. Check your connection and try again.');
  }
  const text = await res.text();
  // A gateway or crash can answer with a plain error page instead of JSON.
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  // An expired session can't save anything, so send the user back to sign in.
  // A 401 from the auth routes just means a wrong password, so that's left alone.
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    clearSession();
    window.location.reload();
  }
  if (!res.ok) throw new Error((data && data.error) || `Something went wrong (error ${res.status}). Please try again.`);
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),

  // auth
  login: (username, password) => request('POST', '/api/auth/login', { username, password }),
  register: (payload) => request('POST', '/api/auth/register', payload),
  authOptions: () => request('GET', '/api/auth/options'),
};
