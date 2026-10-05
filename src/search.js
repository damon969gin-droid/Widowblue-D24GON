/**
 * WidowBlue – ricerca web modulare multi-provider
 * Provider predefinito: Exa (poi Google CSE, Serper, Tavily, Wikipedia, …)
 */

const UA =
  'Mozilla/5.0 (compatible; WidowBlue/0.2; +https://github.com/damon969gin-droid/Widowblue-D24GON)';

const WEB_PROVIDERS = new Set(['tavily', 'serper', 'exa', 'perplexity', 'brave', 'google', 'bing']);

function normalizeQuery(q) {
  return String(q || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  return normalizeQuery(s)
    .split(' ')
    .filter((t) => t.length > 2);
}

function scoreResult(r, qTokens) {
  const title = String(r.title || '').toLowerCase();
  const sn = String(r.snippet || '').toLowerCase();
  let score = 0;
  if (r.kind === 'summary') score += 20;
  if (r.provider === 'exa') score += r.kind === 'summary' ? 70 : 45;
  if (r.provider === 'tavily') score += r.kind === 'summary' ? 50 : 25;
  if (r.provider === 'serper') score += r.kind === 'summary' ? 52 : 28;
  if (r.provider === 'google') score += r.kind === 'summary' ? 55 : 30;
  if (r.provider === 'perplexity') score += r.kind === 'summary' ? 40 : 15;
  if (r.provider === 'brave' || r.provider === 'bing') score += 12;
  if (r.provider === 'wikipedia') score += r.kind === 'summary' ? 35 : 10;
  if (/disambigua|disambiguation/i.test(title + sn)) score -= 25;
  if (/procaccini|pittore|painter/i.test(title + sn)) score -= 10;
  if (/classifica|serie a|capolista|standings/i.test(title + sn)) score += 18;
  if (qTokens.length >= 2) {
    let hits = 0;
    for (const t of qTokens) if (title.includes(t) || sn.includes(t)) hits++;
    if (hits === 0) score -= 20;
    else score += hits * 3;
  }
  return score;
}

function focusAnswer(query, text, title) {
  const ql = String(query || '').toLowerCase();
  let t = String(text || '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\[\.\.\.\]/g, ' ')
    .replace(/\*{1,2}/g, '')
    .replace(/What Are [^?\n]+\?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const name = String(title || '')
    .replace(/\s*\([A-Z]{2}\)\s*$/i, '')
    .replace(/^Sintesi\s+(Tavily|Perplexity|Serper|Google|Exa).*$/i, '')
    .trim();
  if (name && t && !t.toLowerCase().includes(name.toLowerCase().slice(0, 12)) && t.length < 400) {
    t = name + ': ' + t;
  }
  return t.slice(0, 1200);
}

function pickBestAnswer(unique, q) {
  // Exa predefinito: priorità assoluta
  const exaSummary = unique.find(
    (r) => r.provider === 'exa' && r.kind === 'summary' && r.snippet && r.snippet.length > 20
  );
  if (exaSummary) {
    return { text: focusAnswer(q, exaSummary.snippet, exaSummary.title), title: exaSummary.title, url: exaSummary.url, provider: 'exa' };
  }
  const exaHit = unique.find((r) => r.provider === 'exa' && r.snippet && r.snippet.length > 40);
  if (exaHit) {
    return { text: focusAnswer(q, exaHit.snippet, exaHit.title), title: exaHit.title, url: exaHit.url, provider: 'exa' };
  }
  const googleLike = unique.find(
    (r) => (r.provider === 'google' || r.provider === 'serper') && r.kind === 'summary' && r.snippet && r.snippet.length > 20
  );
  if (googleLike) {
    return { text: focusAnswer(q, googleLike.snippet, googleLike.title), title: googleLike.title, url: googleLike.url, provider: googleLike.provider };
  }
  const webSummary = unique.find((r) => WEB_PROVIDERS.has(r.provider) && r.kind === 'summary' && r.snippet && r.snippet.length > 20);
  if (webSummary) {
    return { text: focusAnswer(q, webSummary.snippet, webSummary.title), title: webSummary.title, url: webSummary.url, provider: webSummary.provider };
  }
  const googleHit = unique.find((r) => (r.provider === 'google' || r.provider === 'serper') && r.snippet && r.snippet.length > 40);
  if (googleHit) {
    return { text: focusAnswer(q, googleHit.snippet, googleHit.title), title: googleHit.title, url: googleHit.url, provider: googleHit.provider };
  }
  const webHit = unique.find((r) => WEB_PROVIDERS.has(r.provider) && r.snippet && r.snippet.length > 40);
  if (webHit) {
    return { text: focusAnswer(q, webHit.snippet, webHit.title), title: webHit.title, url: webHit.url, provider: webHit.provider };
  }
  const wiki = unique.find((r) => r.provider === 'wikipedia' && r.kind === 'summary' && r.snippet);
  if (wiki) {
    return { text: focusAnswer(q, wiki.snippet, wiki.title), title: wiki.title, url: wiki.url, provider: wiki.provider };
  }
  const any = unique.find((r) => r.snippet && r.snippet.length > 30);
  if (any) {
    return { text: focusAnswer(q, any.snippet, any.title), title: any.title, url: any.url, provider: any.provider };
  }
  return null;
}

async function runProvider(name, fn) {
  const t0 = Date.now();
  try {
    const results = await fn();
    return { name, ok: true, results: results || [], ms: Date.now() - t0 };
  } catch (e) {
    return { name, ok: false, results: [], ms: Date.now() - t0, error: String(e && e.message ? e.message : e) };
  }
}

export async function modularSearch(query, opts = {}) {
  const q = String(query || '').trim().slice(0, 300);
  if (!q) return { ok: false, error: 'empty_query', results: [], providers: [] };

  const qNorm = normalizeQuery(q);
  const qTokens = tokens(qNorm);
  const deep = !!opts.deep;
  const env = opts.env || {};
  let lang = String(opts.lang || 'it').toLowerCase().slice(0, 2) || 'it';
  const providers = [];
  const results = [];
  const errors = [];

  const jobs = [];
  // Exa predefinito: avviato per primo
  if (env.EXA_API_KEY) {
    jobs.push(runProvider('exa', () => searchExa(q, env.EXA_API_KEY, deep ? 12 : 8)));
  }
  if (env.GOOGLE_API_KEY && env.GOOGLE_CSE_ID) {
    jobs.push(runProvider('google', () => searchGoogle(q, env.GOOGLE_API_KEY, env.GOOGLE_CSE_ID, deep ? 10 : 8)));
  }
  if (env.SERPER_API_KEY) {
    jobs.push(runProvider('serper', () => searchSerper(q, env.SERPER_API_KEY, deep ? 10 : 8, lang)));
  }
  if (env.TAVILY_API_KEY) {
    jobs.push(runProvider('tavily', () => searchTavily(q, env.TAVILY_API_KEY, deep)));
  }
  jobs.push(runProvider('wikipedia', () => searchWikipedia(q, qNorm, qTokens, lang)));
  jobs.push(runProvider('duckduckgo', () => searchDuckDuckGo(qNorm || q)));
  if (env.BRAVE_API_KEY) jobs.push(runProvider('brave', () => searchBrave(q, env.BRAVE_API_KEY, deep ? 10 : 5)));
  if (env.BING_API_KEY) jobs.push(runProvider('bing', () => searchBing(q, env.BING_API_KEY, deep ? 10 : 5, lang)));
  if (env.PERPLEXITY_API_KEY) jobs.push(runProvider('perplexity', () => searchPerplexity(q, env.PERPLEXITY_API_KEY, deep, lang)));

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
    r._score = scoreResult(r, qTokens) + (r.lang === lang ? 18 : 0);
    unique.push(r);
  }
  unique.sort((a, b) => (b._score || 0) - (a._score || 0));
  const minScore = deep ? 8 : 12;
  unique = unique.filter((r) => (r._score || 0) >= minScore || r.kind === 'summary');
  if (!unique.length) {
    unique = results
      .map((r) => {
        r._score = scoreResult(r, qTokens);
        return r;
      })
      .sort((a, b) => (b._score || 0) - (a._score || 0))
      .slice(0, 6);
  }
  unique = unique.slice(0, deep ? 12 : 8);

  const answer = pickBestAnswer(unique, q);
  const webActive = providers.some((p) => WEB_PROVIDERS.has(p.name) && p.ok && p.count > 0);

  return {
    ok: true,
    query: q,
    queryNormalized: qNorm,
    deep,
    lang,
    answer,
    webLive: webActive,
    providers,
    errors,
    results: unique.map(({ _score, ...rest }) => rest),
    policy: {
      respectful: true,
      notes: ['Priorità Exa (predefinito)', 'Fallback: Google CSE / Serper / Tavily', 'Lingua: ' + lang],
    },
    fetchedAt: Date.now(),
  };
}

async function searchWikipedia(q, qNorm, qTokens, lang = 'it') {
  const wikiLang = ['it', 'en', 'es', 'fr', 'de', 'pt', 'pl', 'nl', 'ru', 'ja', 'zh', 'ar', 'ko'].includes(lang) ? lang : 'it';
  const searchUrl =
    'https://' +
    wikiLang +
    '.wikipedia.org/w/api.php?action=opensearch&search=' +
    encodeURIComponent(q) +
    '&limit=5&namespace=0&format=json&origin=*';
  const res = await fetch(searchUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error('wikipedia HTTP ' + res.status);
  const data = await res.json();
  const titles = data[1] || [];
  const descs = data[2] || [];
  const urls = data[3] || [];
  const out = [];
  for (let i = 0; i < titles.length; i++) {
    out.push({
      provider: 'wikipedia',
      kind: i === 0 ? 'summary' : 'doc',
      title: titles[i],
      url: urls[i] || '',
      snippet: descs[i] || titles[i],
      lang: wikiLang,
      fetchedAt: Date.now(),
    });
  }
  if (titles[0]) {
    try {
      const sumUrl =
        'https://' +
        wikiLang +
        '.wikipedia.org/api/rest_v1/page/summary/' +
        encodeURIComponent(titles[0].replace(/ /g, '_'));
      const sr = await fetch(sumUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (sr.ok) {
        const sj = await sr.json();
        if (sj.extract) {
          out.unshift({
            provider: 'wikipedia',
            kind: 'summary',
            title: sj.title || titles[0],
            url: (sj.content_urls && sj.content_urls.desktop && sj.content_urls.desktop.page) || urls[0] || '',
            snippet: String(sj.extract).slice(0, 900),
            lang: wikiLang,
            fetchedAt: Date.now(),
          });
        }
      }
    } catch (_) {}
  }
  return out;
}

async function searchDuckDuckGo(q) {
  const url = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1&skip_disambig=1';
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error('duckduckgo HTTP ' + res.status);
  const data = await res.json();
  const out = [];
  if (data.AbstractText) {
    out.push({
      provider: 'duckduckgo',
      kind: 'summary',
      title: data.Heading || 'DuckDuckGo',
      url: data.AbstractURL || data.AbstractSource || '',
      snippet: data.AbstractText,
      fetchedAt: Date.now(),
    });
  }
  for (const t of data.RelatedTopics || []) {
    if (t.Text && t.FirstURL) {
      out.push({ provider: 'duckduckgo', title: t.Text.slice(0, 80), url: t.FirstURL, snippet: t.Text, fetchedAt: Date.now() });
    }
  }
  return out.slice(0, 6);
}

async function searchExa(q, apiKey, num = 6) {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': apiKey,
      'User-Agent': UA,
    },
    body: JSON.stringify({
      query: q,
      type: 'auto',
      numResults: Math.min(Math.max(1, num), 10),
      contents: { text: { maxCharacters: 1200 } },
    }),
  });
  if (!res.ok) throw new Error('exa HTTP ' + res.status);
  const data = await res.json();
  const out = [];
  const results = data.results || [];
  for (const r of results) {
    const snippet =
      (r.text && String(r.text).slice(0, 900)) ||
      (Array.isArray(r.highlights) && r.highlights.join(' ')) ||
      r.summary ||
      '';
    out.push({
      provider: 'exa',
      title: r.title || '',
      url: r.url || r.id || '',
      snippet: String(snippet || '').slice(0, 900),
      fetchedAt: Date.now(),
    });
  }
  if (out.length && out[0].snippet && out[0].snippet.length > 80) {
    out.unshift({
      provider: 'exa',
      kind: 'summary',
      title: out[0].title ? 'Sintesi Exa · ' + out[0].title : 'Sintesi Exa',
      url: out[0].url,
      snippet: out[0].snippet,
      fetchedAt: Date.now(),
    });
  }
  return out;
}

async function searchTavily(q, apiKey, deep) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
    body: JSON.stringify({
      api_key: apiKey,
      query: q,
      search_depth: deep ? 'advanced' : 'basic',
      max_results: deep ? 8 : 5,
      include_answer: true,
      include_raw_content: false,
    }),
  });
  if (!res.ok) throw new Error('tavily HTTP ' + res.status);
  const data = await res.json();
  const out = [];
  if (data.answer) {
    out.push({
      provider: 'tavily',
      kind: 'summary',
      title: 'Sintesi Tavily',
      url: (data.results && data.results[0] && data.results[0].url) || 'https://tavily.com/',
      snippet: String(data.answer).slice(0, 900),
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

async function searchSerper(q, apiKey, num = 5, lang = 'it') {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ q, num: Math.min(Math.max(1, num), 10), gl: lang || 'it', hl: lang || 'it', autocorrect: true }),
  });
  if (!res.ok) throw new Error('serper HTTP ' + res.status);
  const data = await res.json();
  const out = [];
  if (data.answerBox && (data.answerBox.answer || data.answerBox.snippet)) {
    out.push({
      provider: 'serper',
      kind: 'summary',
      title: data.answerBox.title || 'Google Answer',
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
    out.push({ provider: 'serper', title: r.title || '', url: r.link || '', snippet: r.snippet || '', fetchedAt: Date.now() });
  }
  return out;
}

async function searchBrave(q, apiKey, count = 5) {
  const url = 'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(q) + '&count=' + count;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey, 'User-Agent': UA },
  });
  if (!res.ok) throw new Error('brave HTTP ' + res.status);
  const data = await res.json();
  const out = [];
  for (const r of (data.web && data.web.results) || []) {
    out.push({ provider: 'brave', title: r.title || '', url: r.url || '', snippet: r.description || '', fetchedAt: Date.now() });
  }
  return out;
}

async function searchGoogle(q, apiKey, cx, num = 5) {
  const url =
    'https://www.googleapis.com/customsearch/v1?key=' +
    encodeURIComponent(apiKey) +
    '&cx=' +
    encodeURIComponent(cx) +
    '&q=' +
    encodeURIComponent(q) +
    '&num=' +
    Math.min(Math.max(1, num), 10);
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error('google HTTP ' + res.status);
  const data = await res.json();
  const out = [];
  for (const r of data.items || []) {
    out.push({ provider: 'google', title: r.title || '', url: r.link || '', snippet: r.snippet || '', fetchedAt: Date.now() });
  }
  return out;
}

async function searchBing(q, apiKey, count = 5, lang = 'it') {
  const url =
    'https://api.bing.microsoft.com/v7.0/search?q=' +
    encodeURIComponent(q) +
    '&count=' +
    count +
    '&mkt=' +
    (lang === 'it' ? 'it-IT' : 'en-US');
  const res = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey, Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) throw new Error('bing HTTP ' + res.status);
  const data = await res.json();
  const out = [];
  for (const r of (data.webPages && data.webPages.value) || []) {
    out.push({ provider: 'bing', title: r.name || '', url: r.url || '', snippet: r.snippet || '', fetchedAt: Date.now() });
  }
  return out;
}

async function searchPerplexity(q, apiKey, deep, lang = 'it') {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': UA,
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content:
            'Rispondi in ' +
            (lang === 'it' ? 'italiano' : lang) +
            ' in modo conciso e fattuale, citando fonti quando possibile.',
        },
        { role: 'user', content: q },
      ],
      temperature: 0.2,
      max_tokens: 800,
    }),
  });
  if (!res.ok) throw new Error('perplexity HTTP ' + res.status);
  const data = await res.json();
  const text =
    (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  const out = [];
  if (text) {
    out.push({
      provider: 'perplexity',
      kind: 'summary',
      title: 'Sintesi Perplexity',
      url: 'https://www.perplexity.ai/',
      snippet: String(text).slice(0, 900),
      fetchedAt: Date.now(),
    });
  }
  return out;
}
