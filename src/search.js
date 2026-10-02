/**
 * WidowBlue – ricerca web modulare multi-provider
 * Priorità: Google CSE + Serper → Tavily → Wikipedia → DDG
 * Ranking + filtro pertinenza
 */

const UA = 'WidowBlueBot/0.9 (+https://github.com/damon969gin-droid/Widowblue-D24GON; research; respectful)';
const TIMEOUT_MS = 12000;
const WEB_PROVIDERS = new Set(['tavily', 'serper', 'perplexity', 'brave', 'google', 'bing']);

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
  const title = (r.title || '').toLowerCase().replace(/\s*\([a-z]{2}\)\s*$/i, '');
  const sn = (r.snippet || '').toLowerCase();
  let score = 0;
  for (const t of qTokens) {
    if (title.includes(t)) score += 10;
    if (sn.includes(t)) score += 2;
  }
  if (qTokens.length && qTokens.every((t) => title.includes(t))) score += 25;
  if (title.length < 45) score += 4;
  if (r.kind === 'summary') score += 20;
  if (r.provider === 'tavily') score += r.kind === 'summary' ? 50 : 25;
  if (r.provider === 'serper') score += r.kind === 'summary' ? 52 : 28;
  if (r.provider === 'google') score += r.kind === 'summary' ? 55 : 30;
  if (r.provider === 'perplexity') score += r.kind === 'summary' ? 40 : 15;
  if (r.provider === 'brave' || r.provider === 'bing') score += 12;
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
    .replace(/^Sintesi\s+(Tavily|Perplexity|Serper|Google).*$/i, '')
    .trim();

  if (/nato|nascita|\bborn\b|when was|data di nascita/i.test(ql)) {
    const patterns = [
      /nato(?:\s+a)?\s+[^.]{5,90}/i,
      /nata(?:\s+a)?\s+[^.]{5,90}/i,
      /born\s+(?:on\s+)?[^.]{5,90}/i,
      /\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+\d{1,4}/i,
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (m) {
        let bit = m[0].replace(/^[,\s(]+|[)\s.]+$/g, '').trim();
        if (/^nato|^nata|^born/i.test(bit)) return (name ? name + ' è ' : '') + bit + '.';
        return (name ? name + ' è nato il ' : 'Nato il ') + bit + '.';
      }
    }
  }

  if (/^chi\s|^cos|^what is|^who is/i.test(ql)) {
    const first = t.split(/(?<=[.!?])\s+/)[0];
    if (first && first.length > 20) return first.trim();
  }

  if (t.length <= 900) return t.trim();
  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  let out = '';
  for (const s of sentences.slice(0, 6)) {
    if ((out + ' ' + s).length > 900) break;
    out = out ? out + ' ' + s : s;
  }
  return out || t.slice(0, 900);
}

function pickBestAnswer(unique, q) {
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
  const any = unique.find((r) => r.snippet && r.snippet.length > 40);
  if (any) {
    return { text: focusAnswer(q, any.snippet, any.title), title: any.title, url: any.url, provider: any.provider };
  }
  return null;
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
      notes: ['Priorità Google CSE / Serper', 'Lingua: ' + lang, 'Filtro pertinenza attivo'],
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
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

async function wikiOpenSearch(lang, term) {
  const url =
    'https://' + lang + '.wikipedia.org/w/api.php?action=opensearch&limit=5&namespace=0&format=json&origin=*&search=' +
    encodeURIComponent(term);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error('wikipedia-' + lang + ' HTTP ' + res.status);
  const data = await res.json();
  const titles = data[1] || [];
  const descs = data[2] || [];
  const urls = data[3] || [];
  return titles.map((title, i) => ({
    provider: 'wikipedia',
    title: title + ' (' + String(lang).toUpperCase() + ')',
    url: urls[i] || '',
    snippet: descs[i] || '',
    lang,
    wikiTitle: title,
    fetchedAt: Date.now(),
  }));
}

async function wikiListSearch(lang, term) {
  const searchUrl =
    'https://' + lang + '.wikipedia.org/w/api.php?action=query&list=search&srlimit=5&format=json&origin=*&srsearch=' +
    encodeURIComponent(term);
  const res = await fetch(searchUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error('wikipedia-list-' + lang + ' HTTP ' + res.status);
  const data = await res.json();
  const hits = (data.query && data.query.search) || [];
  return hits.map((h) => ({
    provider: 'wikipedia',
    title: h.title + ' (' + String(lang).toUpperCase() + ')',
    url: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(h.title.replace(/ /g, '_')),
    snippet: (h.snippet || '').replace(/<[^>]+>/g, ''),
    lang,
    wikiTitle: h.title,
    fetchedAt: Date.now(),
  }));
}

async function wikiSummary(lang, title) {
  const url = 'https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'));
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.type === 'disambiguation') return null;
  const extract = data.extract || data.description || '';
  if (!extract || extract.length < 20) return null;
  return {
    provider: 'wikipedia',
    kind: 'summary',
    title: (data.title || title) + ' (' + String(lang).toUpperCase() + ')',
    url: (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) ||
      'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')),
    snippet: extract,
    lang,
    wikiTitle: data.title || title,
    fetchedAt: Date.now(),
  };
}

async function searchWikipedia(q, qNorm, qTokens, lang = 'it') {
  const terms = [...new Set([qNorm, q].filter(Boolean))];
  const primary = lang || 'it';
  const secondary = primary === 'en' ? 'it' : 'en';
  const jobs = [];
  for (const term of terms) {
    jobs.push(wikiOpenSearch(primary, term));
    jobs.push(wikiListSearch(primary, term));
    jobs.push(wikiOpenSearch(secondary, term));
    jobs.push(wikiListSearch(secondary, term));
  }
  const parts = await Promise.all(jobs.map((p) => p.catch(() => [])));
  const out = [];
  const seen = new Set();
  for (const arr of parts) {
    for (const r of arr) {
      const k = (r.url || r.title).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      r._score = scoreResult(r, qTokens) + (r.lang === primary ? 15 : 0);
      out.push(r);
    }
  }
  out.sort((a, b) => (b._score || 0) - (a._score || 0));
  const top = out.slice(0, 4);
  const summaries = await Promise.all(
    top.map((r) => (r.wikiTitle && r.lang ? wikiSummary(r.lang, r.wikiTitle).catch(() => null) : Promise.resolve(null)))
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
  const url = 'https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=' + encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error('duckduckgo HTTP ' + res.status);
  const data = await res.json();
  const out = [];
  if (data.AbstractText) {
    out.push({ provider: 'duckduckgo', kind: 'summary', title: data.Heading || q, url: data.AbstractURL || '', snippet: data.AbstractText, fetchedAt: Date.now() });
  }
  for (const item of data.RelatedTopics || []) {
    if (item.Text && item.FirstURL) {
      out.push({ provider: 'duckduckgo', title: (item.Text || '').slice(0, 80), url: item.FirstURL, snippet: item.Text, fetchedAt: Date.now() });
    }
  }
  return out.slice(0, 6);
}

async function searchTavily(q, apiKey, deep) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ api_key: apiKey, query: q, search_depth: deep ? 'advanced' : 'basic', max_results: deep ? 8 : 5, include_answer: true, include_raw_content: false }),
  });
  if (!res.ok) throw new Error('tavily HTTP ' + res.status);
  const data = await res.json();
  const out = [];
  if (data.answer) {
    out.push({ provider: 'tavily', kind: 'summary', title: 'Sintesi Tavily', url: (data.results && data.results[0] && data.results[0].url) || 'https://tavily.com/', snippet: String(data.answer).slice(0, 900), fetchedAt: Date.now() });
  }
  for (const r of data.results || []) {
    out.push({ provider: 'tavily', title: r.title || '', url: r.url || '', snippet: r.content || r.snippet || '', fetchedAt: Date.now() });
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
    out.push({ provider: 'serper', kind: 'summary', title: data.answerBox.title || 'Google Answer', url: data.answerBox.link || '', snippet: data.answerBox.answer || data.answerBox.snippet || '', fetchedAt: Date.now() });
  }
  if (data.knowledgeGraph && data.knowledgeGraph.description) {
    out.push({ provider: 'serper', kind: 'summary', title: data.knowledgeGraph.title || 'Knowledge Graph', url: data.knowledgeGraph.descriptionLink || data.knowledgeGraph.website || '', snippet: data.knowledgeGraph.description, fetchedAt: Date.now() });
  }
  for (const r of data.organic || []) {
    out.push({ provider: 'serper', title: r.title || '', url: r.link || '', snippet: r.snippet || '', fetchedAt: Date.now() });
  }
  return out;
}

async function searchBrave(q, apiKey, count = 5) {
  const url = 'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(q) + '&count=' + count;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey, 'User-Agent': UA } });
  if (!res.ok) throw new Error('brave HTTP ' + res.status);
  const data = await res.json();
  return ((data.web && data.web.results) || []).map((r) => ({ provider: 'brave', title: r.title || '', url: r.url || '', snippet: r.description || '', fetchedAt: Date.now() }));
}

async function searchGoogle(q, apiKey, cx, num = 5) {
  const n = Math.min(Math.max(1, num), 10);
  const url = 'https://www.googleapis.com/customsearch/v1?key=' + encodeURIComponent(apiKey) + '&cx=' + encodeURIComponent(cx) + '&q=' + encodeURIComponent(q) + '&num=' + n;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error('google HTTP ' + res.status);
  const data = await res.json();
  return (data.items || []).map((item) => ({ provider: 'google', title: item.title || '', url: item.link || '', snippet: item.snippet || '', fetchedAt: Date.now() }));
}

async function searchBing(q, apiKey, count = 5, lang = 'it') {
  const n = Math.min(Math.max(1, count), 10);
  const url = 'https://api.bing.microsoft.com/v7.0/search?q=' + encodeURIComponent(q) + '&count=' + n + '&mkt=' + (lang === 'it' ? 'it-IT' : 'en-US');
  const res = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': apiKey, Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error('bing HTTP ' + res.status);
  const data = await res.json();
  return ((data.webPages && data.webPages.value) || []).map((r) => ({ provider: 'bing', title: r.name || '', url: r.url || '', snippet: r.snippet || '', fetchedAt: Date.now() }));
}

async function searchPerplexity(q, apiKey, deep, lang = 'it') {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: deep ? 'sonar-pro' : 'sonar',
      messages: [
        { role: 'system', content: 'Answer in ' + lang + '. Be concise and factual.' },
        { role: 'user', content: q },
      ],
      temperature: 0.2,
      max_tokens: 600,
    }),
  });
  if (!res.ok) throw new Error('perplexity HTTP ' + res.status);
  const data = await res.json();
  const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  if (!text) return [];
  return [{ provider: 'perplexity', kind: 'summary', title: 'Sintesi Perplexity', url: 'https://www.perplexity.ai/', snippet: text.slice(0, 900), fetchedAt: Date.now() }];
}
