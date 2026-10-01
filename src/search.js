/**
 * WidowBlue – ricerca web modulare multi-provider
 *
 * Sempre: wikipedia, duckduckgo
 * Opzionali (secret Cloudflare Pages):
 *   TAVILY_API_KEY        (1k crediti/mese, no carta)
 *   SERPER_API_KEY        (trial gratis ~2500 query)
 *   BRAVE_API_KEY
 *   GOOGLE_API_KEY + GOOGLE_CSE_ID
 *   BING_API_KEY
 *   PERPLEXITY_API_KEY
 */

const UA = 'WidowBlueBot/0.4 (+https://github.com/damon969gin-droid/Widowblue-D24GON; research; respectful)';
const TIMEOUT_MS = 10000;

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

  if (env.TAVILY_API_KEY) {
    jobs.push(runProvider('tavily', () => searchTavily(q, env.TAVILY_API_KEY, deep)));
  }
  if (env.SERPER_API_KEY) {
    jobs.push(runProvider('serper', () => searchSerper(q, env.SERPER_API_KEY, deep ? 10 : 5)));
  }
  if (env.BRAVE_API_KEY) {
    jobs.push(runProvider('brave', () => searchBrave(q, env.BRAVE_API_KEY, deep ? 10 : 5)));
  }
  if (env.GOOGLE_API_KEY && env.GOOGLE_CSE_ID) {
    jobs.push(
      runProvider('google', () => searchGoogle(q, env.GOOGLE_API_KEY, env.GOOGLE_CSE_ID, deep ? 10 : 5))
    );
  }
  if (env.BING_API_KEY) {
    jobs.push(runProvider('bing', () => searchBing(q, env.BING_API_KEY, deep ? 10 : 5)));
  }
  if (env.PERPLEXITY_API_KEY) {
    jobs.push(runProvider('perplexity', () => searchPerplexity(q, env.PERPLEXITY_API_KEY, deep)));
  }

  const settled = await Promise.all(jobs);
  for (const s of settled) {
    providers.push({ name: s.name, ok: s.ok, count: s.results.length, ms: s.ms, error: s.error || null });
    if (s.ok) results.push(...s.results);
    else errors.push({ provider: s.name, error: s.error });
  }

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
    results: unique.slice(0, deep ? 40 : 15),
    policy: {
      respectful: true,
      notes: [
        'Solo API ufficiali (no scraping SERP)',
        'Rispetta quote e ToS di ogni provider',
        'Nessun bypass paywall/CAPTCHA',
        'Tracciabilità: provider + url su ogni item',
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
  for (const item of data.RelatedTopics || []) {
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

/** Tavily – free 1k credits/month, no card */
async function searchTavily(q, apiKey, deep) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': UA,
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: q,
      search_depth: deep ? 'advanced' : 'basic',
      max_results: deep ? 10 : 5,
      include_answer: true,
      include_raw_content: false,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error('tavily HTTP ' + res.status + (errBody ? ': ' + errBody.slice(0, 120) : ''));
  }
  const data = await res.json();
  const out = [];
  if (data.answer) {
    out.push({
      provider: 'tavily',
      title: 'Sintesi Tavily',
      url: 'https://tavily.com/',
      snippet: String(data.answer).slice(0, 600),
      fetchedAt: Date.now(),
    });
  }
  for (const r of data.results || []) {
    out.push({
      provider: 'tavily',
      title: r.title || '',
      url: r.url || '',
      snippet: r.content || r.snippet || '',
      fetchedAt: Date.now(),
    });
  }
  return out;
}

/** Serper – Google SERP JSON, trial gratuito */
async function searchSerper(q, apiKey, num = 5) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': UA,
    },
    body: JSON.stringify({ q, num: Math.min(Math.max(1, num), 10) }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error('serper HTTP ' + res.status + (errBody ? ': ' + errBody.slice(0, 120) : ''));
  }
  const data = await res.json();
  const out = [];
  if (data.answerBox && (data.answerBox.answer || data.answerBox.snippet)) {
    out.push({
      provider: 'serper',
      title: data.answerBox.title || 'Answer Box',
      url: data.answerBox.link || '',
      snippet: data.answerBox.answer || data.answerBox.snippet || '',
      fetchedAt: Date.now(),
    });
  }
  if (data.knowledgeGraph && data.knowledgeGraph.description) {
    out.push({
      provider: 'serper',
      title: data.knowledgeGraph.title || 'Knowledge Graph',
      url: data.knowledgeGraph.descriptionLink || data.knowledgeGraph.website || '',
      snippet: data.knowledgeGraph.description,
      fetchedAt: Date.now(),
    });
  }
  for (const r of data.organic || []) {
    out.push({
      provider: 'serper',
      title: r.title || '',
      url: r.link || '',
      snippet: r.snippet || '',
      fetchedAt: Date.now(),
    });
  }
  return out;
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
  return ((data.web && data.web.results) || []).map((r) => ({
    provider: 'brave',
    title: r.title || '',
    url: r.url || '',
    snippet: r.description || '',
    fetchedAt: Date.now(),
  }));
}

async function searchGoogle(q, apiKey, cx, num = 5) {
  const n = Math.min(Math.max(1, num), 10);
  const url =
    'https://www.googleapis.com/customsearch/v1?key=' +
    encodeURIComponent(apiKey) +
    '&cx=' +
    encodeURIComponent(cx) +
    '&q=' +
    encodeURIComponent(q) +
    '&num=' +
    n;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error('google HTTP ' + res.status + (errBody ? ': ' + errBody.slice(0, 120) : ''));
  }
  const data = await res.json();
  return (data.items || []).map((item) => ({
    provider: 'google',
    title: item.title || '',
    url: item.link || '',
    snippet: item.snippet || '',
    fetchedAt: Date.now(),
  }));
}

async function searchBing(q, apiKey, count = 5) {
  const n = Math.min(Math.max(1, count), 50);
  const url =
    'https://api.bing.microsoft.com/v7.0/search?q=' +
    encodeURIComponent(q) +
    '&count=' +
    n +
    '&mkt=it-IT&textDecorations=false&textFormat=Raw';
  const res = await fetch(url, {
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      Accept: 'application/json',
      'User-Agent': UA,
    },
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error('bing HTTP ' + res.status + (errBody ? ': ' + errBody.slice(0, 120) : ''));
  }
  const data = await res.json();
  const web = (data.webPages && data.webPages.value) || [];
  return web.map((r) => ({
    provider: 'bing',
    title: r.name || '',
    url: r.url || '',
    snippet: r.snippet || '',
    fetchedAt: Date.now(),
  }));
}

async function searchPerplexity(q, apiKey, deep) {
  const model = deep ? 'sonar-pro' : 'sonar';
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': UA,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a research assistant. Reply briefly in Italian. List key facts. Prefer reliable sources.',
        },
        { role: 'user', content: q },
      ],
      temperature: 0.2,
      max_tokens: deep ? 800 : 400,
      return_related_questions: false,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error('perplexity HTTP ' + res.status + (errBody ? ': ' + errBody.slice(0, 160) : ''));
  }
  const data = await res.json();
  const content =
    (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  const out = [];
  const cites = data.citations || data.search_results || [];
  if (Array.isArray(cites)) {
    for (const c of cites.slice(0, deep ? 12 : 6)) {
      if (typeof c === 'string') {
        out.push({
          provider: 'perplexity',
          title: c.replace(/^https?:\/\//, '').slice(0, 80),
          url: c,
          snippet: content.slice(0, 200),
          fetchedAt: Date.now(),
        });
      } else if (c && (c.url || c.link)) {
        out.push({
          provider: 'perplexity',
          title: c.title || c.name || (c.url || c.link),
          url: c.url || c.link,
          snippet: c.snippet || content.slice(0, 200),
          fetchedAt: Date.now(),
        });
      }
    }
  }
  if (content) {
    out.unshift({
      provider: 'perplexity',
      title: 'Sintesi Perplexity',
      url: 'https://www.perplexity.ai/',
      snippet: content.slice(0, 500),
      fetchedAt: Date.now(),
    });
  }
  return out;
}
