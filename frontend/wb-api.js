/* WidowBlue API client – prefers Worker auth, falls back to localStorage via wb-auth.js */
(function () {
  const API = ''; // same origin when served by Worker

  async function api(path, opts) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, (opts && opts.headers) || {});
    const res = await fetch(API + path, Object.assign({}, opts, { headers }));
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  window.wbApi = {
    health: () => api('/api/health'),
    register: (email, password) =>
      api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
    login: (email, password) =>
      api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: (token) =>
      api('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } }),
    logout: (token) =>
      api('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }),
    timedKey: (token) =>
      api('/api/auth/timed-key', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }),
  };
})();
