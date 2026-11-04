// Shared by the API tests: starts the app in memory mode and wraps fetch.
process.env.DB_MODE = 'memory';
const { createApp } = require('../src/app');

async function start() {
  const app = await createApp();
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  // client(token) -> { get, post, patch, del }, each resolving to { status, body }
  const client = (token) => {
    const call = async (method, path, body) => {
      const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    };
    return {
      get: (p) => call('GET', p), post: (p, b) => call('POST', p, b),
      patch: (p, b) => call('PATCH', p, b), del: (p) => call('DELETE', p),
    };
  };

  let n = 0;
  async function signUp(extra = {}) {
    n += 1;
    const res = await client().post('/api/auth/register', {
      full_name: 'Test User', username: `user${n}`, email: `user${n}@example.com`, password: 'secret1', ...extra,
    });
    return { status: res.status, body: res.body, api: res.body?.token ? client(res.body.token) : null };
  }
  return { server, client, signUp };
}

module.exports = { start };
