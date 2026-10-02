/**
 * WidowBlue – RAG: Deep Search + Grounded Generation
 * Answers are user-facing: analyze sources, reason, reply. No system meta.
 * Conversation context filters off-topic results (Serie A ≠ F1).
 */

import { modularSearch } from './search.js';
import { filterResultsByContext } from './context.js';

const MAX_CHUNKS_STD = 8;
const MAX_CHUNKS_DEEP = 16;
const MAX_CONTEXT_STD = 4000;
const MAX_CONTEXT_DEEP = 7000;

export async function runRAG(query, opts = {}) {
  const q = String(query || '').trim().slice(0, 400);
  if (!q) return { ok: false, error: 'empty_query' };

  const deep = !!opts.deep;
  const lang = String(opts.lang || 'it').slice(0, 2);
  const env = opts.env || {};
  const history = Array.isArray(opts.history) ? opts.history : [];
  const convCtx = opts.context || null;

  const retrieval = await deepRetrieve(q, { deep, env, lang });
  let docs = retrieval.docs;
  const searchPrimary = retrieval.primary;

  if (convCtx) {
    docs = filterResultsByContext(docs, convCtx);
    if (searchPrimary && Array.isArray(searchPrimary.results)) {
      searchPrimary.results = filterResultsByContext(searchPrimary.results, convCtx);
    }
  }

  const chunks = chunkDocuments(docs);
  const maxChunks = deep ? MAX_CHUNKS_DEEP : MAX_CHUNKS_STD;
  const rankQ =
    convCtx && convCtx.keywords && convCtx.keywords.length
      ? q + ' ' + convCtx.keywords.slice(0, 6).join(' ')
      : q;
  const ranked = rankChunks(rankQ, chunks).slice(0, maxChunks);

  const maxCtx = deep ? MAX_CONTEXT_DEEP : MAX_CONTEXT_STD;
  const { pack: contextPack, cited } = buildContextPack(ranked, maxCtx);

  const generation = await groundedGenerate(q, contextPack, cited, {
    lang,
    env,
    history,
    priorAnswer: searchPrimary.answer,
    deep,
    topic: convCtx && convCtx.topic,
    entity: convCtx && convCtx.entity,
    domain: convCtx && convCtx.domain,
  });

  const sources = cited
    .filter((c) => c.url)
    .reduce((acc, c) => {
      if (!acc.find((x) => x.url === c.url)) {
        acc.push({
          id: c.id,
          title: c.title || c.url,
          url: c.url,
          provider: c.provider,
          score: Math.round((c.score || 0) * 100) / 100,
        });
      }
      return acc;
    }, [])
    .slice(0, deep ? 10 : 6);

  const cleanText = sanitizeUserText(generation.text);

  return {
    ok: true,
    mode: deep ? 'deep-rag' : 'rag',
    query: q,
    lang,
    deep,
    answer: {
      text: cleanText,
      title: '',
      provider: generation.provider,
      grounded: true,
      citations: generation.citations || [],
      url: sources[0] && sources[0].url,
    },
    rag: {
      retrieved: docs.length,
      chunks: ranked.length,
      queries: retrieval.queries,
      generator: generation.provider,
      contextChars: contextPack.length,
      grounded: true,
      deep,
      sources,
      topic: convCtx && convCtx.topic,
      domain: convCtx && convCtx.domain,
    },
    search: searchPrimary,
    webLive: !!searchPrimary.webLive,
    providers: searchPrimary.providers,
    results: (searchPrimary.results || docs).slice(0, deep ? 12 : 8),
    policy: { respectful: true, grounded: true },
    fetchedAt: Date.now(),
  };
}

function sanitizeUserText(text) {
  let t = String(text || '').trim();
  t = t.replace(/\b(extractive[- ]?grounded|workers-ai-grounded|perplexity-grounded|deep-rag|grounded-empty)\b/gi, '');
  t = t.replace(/\b(RAG|Grounded\s*·[^\n]*|pipeline|provider|generator)\b/gi, '');
  t = t.replace(/\[\d+\]/g, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t.slice(0, 1400);
}

async function deepRetrieve(q, { deep, env, lang }) {
  const queries = [q];
  if (deep) {
    for (const v of expandQueries(q, lang)) {
      if (!queries.includes(v) && v.length > 3) queries.push(v);
    }
  }

  const primary = await modularSearch(q, { deep, env, lang });
  const docs = [...(primary.results || [])];
  const seen = new Set(docs.map((d) => (d.url || d.title || '').toLowerCase()).filter(Boolean));

  if (deep && queries.length > 1) {
    const extras = queries.slice(1, 3);
    const more = await Promise.all(
      extras.map((qq) => modularSearch(qq, { deep: true, env, lang }).catch(() => null))
    );
    for (const s of more) {
      if (!s || !s.results) continue;
      for (const r of s.results) {
        const k = (r.url || r.title || '').toLowerCase();
        if (!k || seen.has(k)) continue;
        seen.add(k);
        docs.push(r);
      }
    }
  }

  if (deep && docs.length < 4) {
    const hop = extractHopTerms(q, docs);
    if (hop) {
      const hopRes = await modularSearch(hop, { deep: true, env, lang }).catch(() => null);
      if (hopRes && hopRes.results) {
        for (const r of hopRes.results) {
          const k = (r.url || r.title || '').toLowerCase();
          if (!k || seen.has(k)) continue;
          seen.add(k);
          docs.push(r);
        }
        if (!queries.includes(hop)) queries.push(hop);
      }
    }
  }

  return { docs, primary, queries };
}

function expandQueries(q, lang) {
  const base = q.replace(/\?+$/, '').trim();
  const out = [];
  if (lang === 'it') {
    out.push(base + ' wikipedia');
    out.push(base + ' fatti');
    if (/quando|nato|nascita/i.test(base)) out.push(base.replace(/quando\s+/i, '') + ' data di nascita');
    if (/chi è|chi e/i.test(base)) out.push(base.replace(/chi\s+[eè]\s+/i, '') + ' biografia');
    if (/cos[a']?\s*[eè]/i.test(base)) out.push(base + ' definizione');
  } else {
    out.push(base + ' facts');
    out.push(base + ' overview');
    if (/when|born/i.test(base)) out.push(base + ' date of birth');
    if (/who is/i.test(base)) out.push(base + ' biography');
  }
  return out.slice(0, 3);
}

function extractHopTerms(q, docs) {
  const title = docs[0] && docs[0].title;
  if (!title) return null;
  const clean = String(title)
    .replace(/\s*\([A-Z]{2}\)\s*$/i, '')
    .replace(/^Sintesi\s+\w+/i, '')
    .trim();
  if (clean.length < 4 || clean.length > 80) return null;
  if (q.toLowerCase().includes(clean.toLowerCase().slice(0, 12))) return null;
  return clean;
}

function tokenize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function chunkDocuments(docs) {
  const out = [];
  for (const d of docs) {
    const text = String(d.snippet || '').trim();
    const title = d.title || '';
    if (!text && !title) continue;
    const parts = splitPassages(text, 360);
    if (!parts.length && title) {
      out.push({ text: title, title, url: d.url || '', provider: d.provider || 'unknown', kind: d.kind || 'doc' });
      continue;
    }
    for (const p of parts) {
      out.push({ text: p, title, url: d.url || '', provider: d.provider || 'unknown', kind: d.kind || 'doc' });
    }
  }
  return out;
}

function splitPassages(text, maxLen) {
  if (!text) return [];
  if (text.length <= maxLen) return [text];
  const sentences = text.split(/(?<=[.!?。])\s+/).filter(Boolean);
  const parts = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + ' ' + s).trim().length > maxLen) {
      if (buf) parts.push(buf.trim());
      buf = s;
    } else {
      buf = buf ? buf + ' ' + s : s;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  const final = [];
  for (const p of parts) {
    if (p.length <= maxLen) final.push(p);
    else for (let i = 0; i < p.length; i += maxLen) final.push(p.slice(i, i + maxLen));
  }
  return final.slice(0, 5);
}

function rankChunks(query, chunks) {
  const qTokens = tokenize(query);
  if (!qTokens.length) return chunks.map((c, i) => ({ ...c, score: 1 / (i + 1) }));

  const N = Math.max(chunks.length, 1);
  const df = {};
  for (const t of qTokens) df[t] = 0;
  for (const c of chunks) {
    const toks = new Set(tokenize(c.text + ' ' + c.title));
    for (const t of qTokens) if (toks.has(t)) df[t]++;
  }

  const k1 = 1.5;
  const b = 0.75;
  const avgdl = chunks.reduce((s, c) => s + tokenize(c.text).length, 0) / N || 1;

  const scored = chunks.map((c) => {
    const docTokens = tokenize(c.text + ' ' + (c.title || ''));
    const tf = {};
    for (const t of docTokens) tf[t] = (tf[t] || 0) + 1;
    const dl = docTokens.length || 1;
    let score = 0;
    for (const t of qTokens) {
      const f = tf[t] || 0;
      if (!f) continue;
      const idf = Math.log(1 + (N - (df[t] || 0) + 0.5) / ((df[t] || 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / avgdl))));
    }
    if (c.kind === 'summary') score *= 1.4;
    if (c.provider === 'tavily' || c.provider === 'serper') score *= 1.25;
    if (c.provider === 'wikipedia') score *= 1.15;
    if (c.provider === 'perplexity') score *= 1.2;
    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function buildContextPack(ranked, maxChars) {
  const lines = [];
  const cited = [];
  let used = 0;
  let i = 0;
  for (const c of ranked) {
    i++;
    const block =
      '[' + i + '] (' + (c.provider || '?') + ') ' + (c.title || '') + '\n' + c.text + (c.url ? '\nURL: ' + c.url : '');
    if (used + block.length > maxChars) break;
    lines.push(block);
    used += block.length;
    cited.push({ id: i, title: c.title, url: c.url, provider: c.provider, score: c.score, text: c.text });
  }
  return { pack: lines.join('\n\n'), cited };
}

async function groundedGenerate(query, context, cited, opts) {
  const lang = opts.lang || 'it';
  const env = opts.env || {};
  const langName =
    { it: 'italiano', en: 'English', es: 'español', fr: 'français', de: 'Deutsch', pt: 'português' }[lang] ||
    'italiano';

  let topicHint = '';
  if (opts.topic || opts.entity) {
    topicHint =
      ' Resta sul tema della conversazione: ' +
      [opts.entity, opts.topic].filter(Boolean).join(' / ') +
      '. Non cambiare argomento (es. se si parla di Serie A non parlare di Formula 1).';
  }
  const system =
    'Sei WidowBlue, assistente di ricerca. Rispondi SOLO in ' +
    langName +
    '. ' +
    'Analizza il contesto, ragiona e dai la risposta più chiara e utile alla domanda. ' +
    'Usa SOLO fatti presenti nel contesto. Non inventare. ' +
    'Non menzionare sistemi, pipeline, RAG, provider, API o dettagli tecnici. ' +
    topicHint +
    ' Scrivi in prosa naturale, max ' +
    (opts.deep ? '8' : '5') +
    ' frasi. Se il contesto non basta, dillo in modo semplice.';

  if (env.AI && context.length > 40) {
    try {
      const text = await generateWithWorkersAI(env.AI, query, context, system);
      if (text) {
        return {
          text: sanitizeUserText(text),
          provider: 'workers-ai-grounded',
          title: '',
          citations: cited.map((c) => c.id),
        };
      }
    } catch (e) {}
  }

  if (env.PERPLEXITY_API_KEY && context.length > 40) {
    try {
      const text = await generateWithPerplexity(env.PERPLEXITY_API_KEY, query, context, system);
      if (text) {
        return {
          text: sanitizeUserText(text),
          provider: 'perplexity-grounded',
          title: '',
          citations: cited.map((c) => c.id),
        };
      }
    } catch (e) {}
  }

  const extractive = extractiveGrounded(query, cited, lang);
  if (extractive.text) {
    return {
      text: sanitizeUserText(extractive.text),
      provider: 'extractive-grounded',
      title: '',
      citations: extractive.citations,
    };
  }

  if (opts.priorAnswer && opts.priorAnswer.text && opts.priorAnswer.text.length > 40) {
    return {
      text: sanitizeUserText(opts.priorAnswer.text),
      provider: (opts.priorAnswer.provider || 'retrieve') + '-grounded',
      title: '',
      citations: cited.slice(0, 3).map((c) => c.id),
    };
  }

  return {
    text:
      lang === 'en'
        ? 'I could not find a reliable answer from the available sources.'
        : 'Non ho trovato una risposta affidabile dalle fonti disponibili.',
    provider: 'grounded-empty',
    title: '',
    citations: [],
  };
}

async function generateWithWorkersAI(AI, query, context, system) {
  const user =
    'Domanda: ' + query + '\n\nContesto dalle fonti:\n' + context + '\n\nRisposta chiara e utile:';
  const res = await AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: 600,
    temperature: 0.15,
  });
  const text =
    (res && (res.response || res.result || res.text)) || (typeof res === 'string' ? res : '');
  return String(text || '').trim().slice(0, 1400);
}

async function generateWithPerplexity(apiKey, query, context, system) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: 'Question: ' + query + '\n\nSources:\n' + context + '\n\nClear useful answer:',
        },
      ],
      temperature: 0.15,
      max_tokens: 600,
    }),
  });
  if (!res.ok) throw new Error('perplexity ' + res.status);
  const data = await res.json();
  return (
    (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
    ''
  )
    .trim()
    .slice(0, 1400);
}

function extractiveGrounded(query, cited, lang) {
  if (!cited.length) return { text: '', citations: [] };

  const qTokens = new Set(tokenize(query));
  const scored = [];

  for (const c of cited) {
    const sentences = String(c.text || '')
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.length > 20);
    for (const s of sentences) {
      const toks = tokenize(s);
      let hit = 0;
      for (const t of toks) if (qTokens.has(t)) hit++;
      if (hit === 0 && qTokens.size > 0) continue;
      scored.push({ s: s.trim(), hit, id: c.id, len: s.length });
    }
  }

  scored.sort((a, b) => b.hit - a.hit || a.len - b.len);

  const picked = [];
  const usedIds = new Set();
  const seen = new Set();
  for (const item of scored) {
    const key = item.s.slice(0, 48).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(item);
    usedIds.add(item.id);
    if (picked.length >= (qTokens.size > 4 ? 4 : 3)) break;
  }

  if (!picked.length) {
    const c0 = cited[0];
    const first = String(c0.text || '')
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.length > 25)
      .slice(0, 2);
    if (!first.length) {
      return { text: String(c0.text || '').slice(0, 500), citations: [c0.id] };
    }
    return { text: first.map((s) => s.trim()).join(' '), citations: [c0.id] };
  }

  return { text: picked.map((p) => p.s).join(' '), citations: [...usedIds] };
}
