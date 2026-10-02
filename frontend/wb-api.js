/* WidowBlue API client – same-origin Worker endpoints */
(function () {
  const BASE = '';

  async function api(path, opts) {
    const headers = Object.assign(
      { 'Content-Type': 'application/json', Accept: 'application/json' },
      (opts && opts.headers) || {}
    );
    const res = await fetch(BASE + path, Object.assign({}, opts || {}, { headers }));
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      data = { error: 'invalid_json', status: res.status };
    }
    // Normalizza: se il body non ha ok, usa lo status HTTP
    if (typeof data.ok === 'undefined') data.ok = res.ok;
    if (!res.ok && !data.error) data.error = 'http_' + res.status;
    return data;
  }

  // Usato da wb-app.js: WB.api('/api/search', { method, body })
  window.WB = {
    api: api,
    health: () => api('/api/health'),
    search: (body) =>
      api('/api/search', { method: 'POST', body: JSON.stringify(body || {}) }),
    orchestrate: (body) =>
      api('/api/orchestrate', { method: 'POST', body: JSON.stringify(body || {}) }),
    image: (body) =>
      api('/api/image', { method: 'POST', body: JSON.stringify(body || {}) }),
    rag: (body) =>
      api('/api/rag', { method: 'POST', body: JSON.stringify(body || {}) }),
  };

  // Alias retrocompatibile
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
        body: JSON.stringify({ query, deep: !!deep, history: history || [], lang: lang || 'auto' }),
      }),
    image: (prompt, lang) =>
      api('/api/image', {
        method: 'POST',
        body: JSON.stringify({ prompt, lang: lang || 'auto' }),
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
          allAgents: !!(opts && opts.allAgents),
        }),
      }),
  };
})();
