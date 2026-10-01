/* WidowBlue API client – auth, search, orchestrate + history + lang */
(function () {
  const API = '';

  async function api(path, opts) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, (opts && opts.headers) || {});
    try {
      const res = await fetch(API + path, Object.assign({}, opts, { headers }));
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { error: 'network', message: String(e.message || e) } };
    }
  }

  window.wbApi = {
    health: () => api('/api/health'),
    register: (email, password) =>
      api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
    login: (email, password) =>
      api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: (token) => api('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } }),
    logout: (token) =>
      api('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }),
    timedKey: (token) =>
      api('/api/auth/timed-key', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }),

    search: (query, deep, history, lang) =>
      api('/api/search', {
        method: 'POST',
        body: JSON.stringify({
          query,
          deep: !!deep,
          history: history || [],
          lang: lang || 'auto',
        }),
      }),

    orchestrate: (prompt, opts) =>
      api('/api/orchestrate', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          deep: !!(opts && opts.deep),
          search: opts && opts.search === false ? false : true,
          attachments: (opts && opts.attachments) || [],
          history: (opts && opts.history) || [],
          lang: (opts && opts.lang) || 'auto',
        }),
      }),
  };
})();
