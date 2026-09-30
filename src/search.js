/**
 * WidowBlue – ricerca web modulare multi-provider
 * Alta disponibilità, tracciabile, rispettosa (User-Agent, timeout, no scrap aggressivo).
 *
 * Providers:
 *  - wikipedia (sempre, free)
 *  - duckduckgo (HTML lite / related topics, free)
 *  - brave (se env.BRAVE_API_KEY)
 *
 * Ogni risultato include: provider, title, url, snippet, fetchedAt
 */

const UA = 'WidowBlueBot/0.2 (+https://github.com/damon969gin-droid/Widowblue-D24GON; research; respectful)';
const TIMEOUT_MS = 8000;

export async function modularSearch(query, opts = {}) {
  const q = String(query || '').trim().slice(0, 300);
  if (!q) return { ok: false, error: 'empty_query', results: [], providers: [] };

  const deep = !!opts.deep;
  const env = opts.env || {};
  const providers = [];
  const results = [];
  const errors = [];

  const jobs = [
    runProvider('wikipedia', () => searchWikipedia(q)),
    runProvider('duckduckgo', () => searchDuckDuckGo(q)),
  ];
  if (env.BRAVE_API_KEY) {
    jobs.push(runProvider('brave', () => searchBrave(q, env.BRAVE_API_KEY, deep ? 10 : 5)));
  }

  const settled = await Promise.all(jobs);
  for (const s of settled) {
    providers.push({ name: s.name, ok: s.ok, count: s.results.length, ms: s.ms, error: s.error || null });
    if (s.ok) results.push(...s.results);
    else errors.push({ provider: s.name, error: s.error });
  }

  // Dedup by URL
  const seen = new Set();
  const unique = [];
  for (const r of results) {
    const key = (r.url || r.title || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }

  return {
    ok: true,
    query: q,
    deep,
    providers,
    errors,
    results: unique.slice(0, deep ? 24 : 12),
    policy: {
      respectful: true,
      notes: [
        'Rispetta robots.txt e ToS di ogni fonte',
        'Rate limit client-side consigliato',
        'Nessun bypass paywall/CAPTCHA',
        'Tracciabilità: ogni item ha provider + url',
      ],
    },
    fetchedAt: Date.now(),
  };
}

async function runProvider(name, fn) {
  const t0 = Date.now();
  try {
    const results = await withTimeout(fn(), TIMEOUT_MS);
    return { name, ok: true, results: results || [], ms: Date.now() - t0 };
  } catch (e) {
    return { name, ok: false, results: [], ms: Date.now() - t0, error: String(e.message || e) };
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

async function searchWikipedia(q) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=opensearch&limit=5&namespace=0&format=json&origin=*&search=' +
    encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error('wikipedia HTTP ' + res.status);
  const data = await res.json();
  // [query, titles[], descriptions[], urls[]]
  const titles = data[1] || [];
  const descs = data[2] || [];
  const urls = data[3] || [];
  return titles.map((title, i) => ({
    provider: 'wikipedia',
    title,
    url: urls[i] || '',
    snippet: descs[i] || '',
    fetchedAt: Date.now(),
  }));
}

async function searchDuckDuckGo(q) {
  // Instant Answer API (no key) – limited but free and respectful
  const url = 'https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=' + encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error('duckduckgo HTTP ' + res.status);
  const data = await res.json();
  const out = [];
  if (data.AbstractText) {
    out.push({
      provider: 'duckduckgo',
      title: data.Heading || q,
      url: data.AbstractURL || '',
      snippet: data.AbstractText,
      fetchedAt: Date.now(),
    });
  }
  const related = data.RelatedTopics || [];
  for (const item of related) {
    if (item.Text && item.FirstURL) {
      out.push({
        provider: 'duckduckgo',
        title: (item.Text || '').slice(0, 80),
        url: item.FirstURL,
        snippet: item.Text,
        fetchedAt: Date.now(),
      });
    }
    if (item.Topics) {
      for (const t of item.Topics.slice(0, 3)) {
        if (t.Text && t.FirstURL) {
          out.push({
            provider: 'duckduckgo',
            title: (t.Text || '').slice(0, 80),
            url: t.FirstURL,
            snippet: t.Text,
            fetchedAt: Date.now(),
          });
        }
      }
    }
  }
  return out.slice(0, 8);
}

async function searchBrave(q, apiKey, count = 5) {
  const url =
    'https://api.search.brave.com/res/v1/web/search?q=' +
    encodeURIComponent(q) +
    '&count=' +
    count;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
      'User-Agent': UA,
    },
  });
  if (!res.ok) throw new Error('brave HTTP ' + res.status);
  const data = await res.json();
  const web = (data.web && data.web.results) || [];
  return web.map((r) => ({
    provider: 'brave',
    title: r.title || '',
    url: r.url || '',
    snippet: r.description || '',
    fetchedAt: Date.now(),
  }));
}
