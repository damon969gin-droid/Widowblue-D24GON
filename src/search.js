/**
 * WidowBlue – ricerca web modulare multi-provider
 * Risposte focalizzate: es. data di nascita da Wikipedia summary
 */

const UA = 'WidowBlueBot/0.7 (+https://github.com/damon969gin-droid/Widowblue-D24GON; research; respectful)';
const TIMEOUT_MS = 12000;

function normalizeQuery(q) {
  let s = String(q || '').trim();
  s = s
    .replace(/^(che\s+)?cos[''\u2019]?\s*[eè]\s+/i, '')
    .replace(/^cosa\s+(è|e)\s+/i, '')
    .replace(/^(when\s+(was|were|is|did)|who\s+(is|was)|what\s+is)\s+/i, '')
    .replace(/^(quando\s+(è|e|fu|nasce|nato)|chi\s+(è|e|era)|dove\s+(è|e|vive)|perché|perche)\s+/i, '')
    .replace(/\b(è|e)\s+nato\b/gi, '')
    .replace(/\bnato\b/gi, '')
    .replace(/\bnascita\b/gi, '')
    .replace(/\bborn\b/gi, '')
    .replace(/\bdate\s+of\s+birth\b/gi, '')
    .replace(/\?+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s || String(q || '').trim();
}

function tokens(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !['the', 'and', 'del', 'della', 'dei', 'delle', 'gli', 'che', 'una', 'per'].includes(t));
}

function scoreResult(r, qTokens) {
  const title = (r.title || '').toLowerCase().replace(/\s*\((it|en)\)\s*$/i, '');
  const sn = (r.snippet || '').toLowerCase();
  let score = 0;
  for (const t of qTokens) {
    if (title.includes(t)) score += 10;
    if (sn.includes(t)) score += 2;
  }
  if (qTokens.length && qTokens.every((t) => title.includes(t))) score += 25;
  if (title.length < 45) score += 4;
  if (r.kind === 'summary') score += 20;
  if (r.provider === 'tavily' || r.provider === 'perplexity' || r.provider === 'serper') score += 6;
  if (/disambigua|disambiguation/i.test(title + sn)) score -= 25;
  if (/procaccini|pittore|painter|atalanta|calcio|football/i.test(title + sn)) score -= 10;
  return score;
}

/** Estrae risposta corta e diretta dalla query + testo fonte */
function focusAnswer(query, text, title) {
  const ql = String(query || '').toLowerCase();
  const t = String(text || '');
  const name = String(title || '').replace(/\s*\((IT|EN)\)\s*$/i, '').trim();

  // Nascita / when born
  if (/nato|nascita|\bborn\b|when was|data di nascita/i.test(ql)) {
    const patterns = [
      /nato(?:\s+a)?\s+[^.]{5,90}/i,
      /nata(?:\s+a)?\s+[^.]{5,90}/i,
      /born\s+(?:on\s+)?[^.]{5,90}/i,
      /\([^)]*?\d{1,2}\s+[a-zà-ù.]+\s+\d{1,4}\s*a\.?\s*C\.?[^)]*\)/i,
      /\([^)]*?\d{1,4}\s*(?:BC|a\.?\s*C\.?)[^)]*\)/i,
      /,\s*\d{1,2}\s+[A-Za-zà-ù.]+\s+\d{1,4}\s*a\.?\s*C\.?/i,
      /\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+\d{1,4}\s*a\.?\s*C\.?/i,
      /\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,4}\s*(?:BC)?/i,
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (m) {
        let bit = m[0].replace(/^[,\s(]+|[)\s.]+$/g, '').trim();
        if (/^nato|^nata|^born/i.test(bit)) {
          return name + ' è ' + bit + '.';
        }
        return name + ' è nato il ' + bit + '.';
      }
    }
  }

  // Chi è / cos'è → prima frase
  if (/^chi\s|^cos|^what is|^who is/i.test(ql)) {
    const first = t.split(/(?<=[.!?])\s+/)[0];
    if (first && first.length > 20) return first.trim();
  }

  // Default: prime 2 frasi max ~350 char
  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  let out = '';
  for (const s of sentences.slice(0, 2)) {
    if ((out + ' ' + s).length > 380) break;
    out = out ? out + ' ' + s : s;
  }
  return out || t.slice(0, 350);
}

export async function modularSearch(query, opts = {}) {
  const q = String(query || '').trim().slice(0, 300);
  if (!q) return { ok: false, error: 'empty_query', results: [], providers: [] };

  const qNorm = normalizeQuery(q);
  const qTokens = tokens(qNorm);
  const deep = !!opts.deep;
  const env = opts.env || {};
  const providers = [];
  const results = [];
  const errors = [];

  const jobs = [
    runProvider('wikipedia', () => searchWikipedia(q, qNorm, qTokens)),
    runProvider('duckduckgo', () => searchDuckDuckGo(qNorm || q)),
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
  let unique = [];
  for (const r of results) {
    const key = (r.url || r.title || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    r._score = scoreResult(r, qTokens);
    unique.push(r);
  }
  unique.sort((a, b) => (b._score || 0) - (a._score || 0));
  // Per domande fattuali: poche fonti di qualità
  const maxRes = deep ? 8 : 5;
  unique = unique.slice(0, maxRes);

  let answer = null;
  const top =
    unique.find((r) => r.kind === 'summary' && r.snippet && (r._score || 0) > 5) ||
    unique.find((r) => r.snippet && r.snippet.length > 40);
  if (top) {
    const focused = focusAnswer(q, top.snippet, top.title);
    answer = {
      text: focused,
      title: top.title,
      url: top.url,
      provider: top.provider,
    };
  }

  return {
    ok: true,
    query: q,
    queryNormalized: qNorm,
    deep,
    answer,
    providers,
    errors,
    results: unique.map(({ _score, ...rest }) => rest),
    policy: {
      respectful: true,
      notes: ['Risposta focalizzata + fonti tracciate', 'Wikipedia summary REST'],
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

async function wikiOpenSearch(lang, term) {
  const url =
    'https://' +
    lang +
    '.wikipedia.org/w/api.php?action=opensearch&limit=5&namespace=0&format=json&origin=*&search=' +
    encodeURIComponent(term);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error('wikipedia-' + lang + ' HTTP ' + res.status);
  const data = await res.json();
  const titles = data[1] || [];
  const descs = data[2] || [];
  const urls = data[3] || [];
  return titles.map((title, i) => ({
    provider: 'wikipedia',
    title: title + (lang === 'it' ? ' (IT)' : ''),
    url: urls[i] || '',
    snippet: descs[i] || '',
    lang,
    wikiTitle: title,
    fetchedAt: Date.now(),
  }));
}

async function wikiListSearch(lang, term) {
  const searchUrl =
    'https://' +
    lang +
    '.wikipedia.org/w/api.php?action=query&list=search&srlimit=5&format=json&origin=*&srsearch=' +
    encodeURIComponent(term);
  const res = await fetch(searchUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error('wikipedia-list-' + lang + ' HTTP ' + res.status);
  const data = await res.json();
  const hits = (data.query && data.query.search) || [];
  return hits.map((h) => ({
    provider: 'wikipedia',
    title: h.title + (lang === 'it' ? ' (IT)' : ''),
    url: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(h.title.replace(/ /g, '_')),
    snippet: (h.snippet || '').replace(/<[^>]+>/g, ''),
    lang,
    wikiTitle: h.title,
    fetchedAt: Date.now(),
  }));
}

async function wikiSummary(lang, title) {
  const url =
    'https://' +
    lang +
    '.wikipedia.org/api/rest_v1/page/summary/' +
    encodeURIComponent(title.replace(/ /g, '_'));
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.type === 'disambiguation') return null;
  const extract = data.extract || data.description || '';
  if (!extract || extract.length < 20) return null;
  return {
    provider: 'wikipedia',
    kind: 'summary',
    title: (data.title || title) + (lang === 'it' ? ' (IT)' : ''),
    url:
      (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) ||
      'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')),
    snippet: extract,
    lang,
    wikiTitle: data.title || title,
    fetchedAt: Date.now(),
  };
}

async function searchWikipedia(q, qNorm, qTokens) {
  const terms = [...new Set([qNorm, q].filter(Boolean))];
  const jobs = [];
  for (const term of terms) {
    jobs.push(wikiOpenSearch('it', term));
    jobs.push(wikiOpenSearch('en', term));
    jobs.push(wikiListSearch('it', term));
    jobs.push(wikiListSearch('en', term));
  }
  const parts = await Promise.all(jobs.map((p) => p.catch(() => [])));
  const out = [];
  const seen = new Set();
  for (const arr of parts) {
    for (const r of arr) {
      const k = (r.url || r.title).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      r._score = scoreResult(r, qTokens);
      out.push(r);
    }
  }
  out.sort((a, b) => (b._score || 0) - (a._score || 0));

  const top = out.slice(0, 4);
  const summaries = await Promise.all(
    top.map((r) =>
      r.wikiTitle && r.lang
        ? wikiSummary(r.lang, r.wikiTitle).catch(() => null)
        : Promise.resolve(null)
    )
  );
  const enriched = [];
  const seen2 = new Set();
  for (const s of summaries) {
    if (!s) continue;
    const k = (s.url || s.title).toLowerCase();
    if (seen2.has(k)) continue;
    seen2.add(k);
    enriched.push(s);
  }
  for (const r of out) {
    const k = (r.url || r.title).toLowerCase();
    if (seen2.has(k)) continue;
    seen2.add(k);
    enriched.push(r);
  }
  return enriched.slice(0, 10);
}

async function searchDuckDuckGo(q) {
  const url =
    'https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=' + encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error('duckduckgo HTTP ' + res.status);
  const data = await res.json();
  const out = [];
  if (data.AbstractText) {
    out.push({
      provider: 'duckduckgo',
      kind: 'summary',
      title: data.Heading || q,
      url: data.AbstractURL || '',
      snippet: data.AbstractText,
      fetchedAt: Date.now(),
    });
  }
  if (data.Definition) {
    out.push({
      provider: 'duckduckgo',
      title: data.Heading || 'Definition',
      url: data.DefinitionURL || data.AbstractURL || '',
      snippet: data.Definition,
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
  }
  return out.slice(0, 6);
}

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
      max_results: deep ? 8 : 5,
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
      kind: 'summary',
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
      kind: 'summary',
      title: data.answerBox.title || 'Answer Box',
      url: data.answerBox.link || '',
      snippet: data.answerBox.answer || data.answerBox.snippet || '',
      fetchedAt: Date.now(),
    });
  }
  if (data.knowledgeGraph && data.knowledgeGraph.description) {
    out.push({
      provider: 'serper',
      kind: 'summary',
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
    for (const c of cites.slice(0, deep ? 8 : 5)) {
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
      kind: 'summary',
      title: 'Sintesi Perplexity',
      url: 'https://www.perplexity.ai/',
      snippet: content.slice(0, 500),
      fetchedAt: Date.now(),
    });
  }
  return out;
}
