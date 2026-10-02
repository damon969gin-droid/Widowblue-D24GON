/**
 * WidowBlue – RAG (Retrieval-Augmented Generation)
 *
 * Pipeline:
 *  1. RETRIEVE  – modular multi-provider search (web live)
 *  2. CHUNK     – split snippets into passages
 *  3. RANK      – lexical relevance (BM25-style)
 *  4. AUGMENT   – build context pack with citations
 *  5. GENERATE  – answer grounded on sources only
 *
 * Generators (priority):
 *  - Cloudflare Workers AI (env.AI) if bound
 *  - Perplexity API if SERPER/PERPLEXITY key
 *  - Extractive synthesis (no LLM required)
 */

import { modularSearch } from './search.js';

const MAX_CHUNKS = 12;
const MAX_CONTEXT_CHARS = 4500;

/**
 * Full RAG run: retrieve → rank → generate
 */
export async function runRAG(query, opts = {}) {
  const q = String(query || '').trim().slice(0, 400);
  if (!q) return { ok: false, error: 'empty_query' };

  const deep = !!opts.deep;
  const lang = String(opts.lang || 'it').slice(0, 2);
  const env = opts.env || {};
  const history = Array.isArray(opts.history) ? opts.history : [];

  // 1) RETRIEVE
  const search = await modularSearch(q, { deep, env, lang });
  const docs = (search.results || []).filter((r) => r.snippet || r.title);

  // 2) CHUNK
  const chunks = chunkDocuments(docs);

  // 3) RANK
  const ranked = rankChunks(q, chunks).slice(0, deep ? MAX_CHUNKS : 8);

  // 4) AUGMENT
  const contextPack = buildContextPack(ranked, MAX_CONTEXT_CHARS);

  // 5) GENERATE
  const generation = await generateAnswer(q, contextPack, {
    lang,
    env,
    history,
    priorAnswer: search.answer,
  });

  const sources = ranked
    .filter((c) => c.url)
    .reduce((acc, c) => {
      if (!acc.find((x) => x.url === c.url)) {
        acc.push({
          title: c.title || c.url,
          url: c.url,
          provider: c.provider,
          score: Math.round(c.score * 100) / 100,
        });
      }
      return acc;
    }, [])
    .slice(0, 6);

  return {
    ok: true,
    mode: 'rag',
    query: q,
    lang,
    answer: {
      text: generation.text,
      title: generation.title || 'RAG',
      provider: generation.provider,
      grounded: true,
      url: sources[0] && sources[0].url,
    },
    rag: {
      retrieved: docs.length,
      chunks: ranked.length,
      generator: generation.provider,
      contextChars: contextPack.length,
      sources,
    },
    search,
    webLive: !!search.webLive,
    providers: search.providers,
    results: search.results,
    policy: {
      respectful: true,
      notes: [
        'RAG: risposta ancorata solo alle fonti recuperate',
        'Nessuna invenzione oltre al contesto',
        'Citazioni tracciabili (provider + url)',
      ],
    },
    fetchedAt: Date.now(),
  };
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

    // Split long snippets into ~280 char passages on sentence boundaries
    const parts = splitPassages(text, 320);
    if (!parts.length && title) {
      out.push({
        text: title,
        title,
        url: d.url || '',
        provider: d.provider || 'unknown',
        kind: d.kind || 'doc',
      });
      continue;
    }
    for (const p of parts) {
      out.push({
        text: p,
        title,
        url: d.url || '',
        provider: d.provider || 'unknown',
        kind: d.kind || 'doc',
      });
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
  // hard split if still huge
  const final = [];
  for (const p of parts) {
    if (p.length <= maxLen) final.push(p);
    else {
      for (let i = 0; i < p.length; i += maxLen) final.push(p.slice(i, i + maxLen));
    }
  }
  return final.slice(0, 4);
}

/** BM25-ish lexical rank */
function rankChunks(query, chunks) {
  const qTokens = tokenize(query);
  if (!qTokens.length) {
    return chunks.map((c, i) => ({ ...c, score: 1 / (i + 1) }));
  }

  const N = Math.max(chunks.length, 1);
  const df = {};
  for (const t of qTokens) df[t] = 0;
  for (const c of chunks) {
    const toks = new Set(tokenize(c.text + ' ' + c.title));
    for (const t of qTokens) if (toks.has(t)) df[t]++;
  }

  const k1 = 1.4;
  const b = 0.75;
  const avgdl =
    chunks.reduce((s, c) => s + tokenize(c.text).length, 0) / N || 1;

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
      const num = f * (k1 + 1);
      const den = f + k1 * (1 - b + b * (dl / avgdl));
      score += idf * (num / den);
    }
    // boost summaries / tavily / serper
    if (c.kind === 'summary') score *= 1.35;
    if (c.provider === 'tavily' || c.provider === 'serper') score *= 1.2;
    if (c.provider === 'wikipedia') score *= 1.1;
    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function buildContextPack(ranked, maxChars) {
  const lines = [];
  let used = 0;
  let i = 0;
  for (const c of ranked) {
    i++;
    const block =
      '[' +
      i +
      '] (' +
      (c.provider || '?') +
      ') ' +
      (c.title || '') +
      '\n' +
      c.text +
      (c.url ? '\nURL: ' + c.url : '');
    if (used + block.length > maxChars) break;
    lines.push(block);
    used += block.length;
  }
  return lines.join('\n\n');
}

async function generateAnswer(query, context, opts) {
  const lang = opts.lang || 'it';
  const env = opts.env || {};
  const langName =
    { it: 'italiano', en: 'English', es: 'español', fr: 'français', de: 'Deutsch', pt: 'português' }[
      lang
    ] || 'italiano';

  // A) Workers AI
  if (env.AI) {
    try {
      const text = await generateWithWorkersAI(env.AI, query, context, langName);
      if (text) return { text, provider: 'workers-ai', title: 'RAG · Workers AI' };
    } catch (e) {
      /* fallback */
    }
  }

  // B) Perplexity as generator with forced context
  if (env.PERPLEXITY_API_KEY) {
    try {
      const text = await generateWithPerplexity(env.PERPLEXITY_API_KEY, query, context, langName);
      if (text) return { text, provider: 'perplexity-rag', title: 'RAG · Perplexity' };
    } catch (e) {
      /* fallback */
    }
  }

  // C) Prefer existing modular search summary if strong
  if (opts.priorAnswer && opts.priorAnswer.text && opts.priorAnswer.text.length > 40) {
    return {
      text: opts.priorAnswer.text,
      provider: opts.priorAnswer.provider || 'retrieve',
      title: opts.priorAnswer.title || 'RAG',
    };
  }

  // D) Extractive synthesis (always available)
  return {
    text: extractiveAnswer(query, context, lang),
    provider: 'extractive-rag',
    title: 'RAG',
  };
}

async function generateWithWorkersAI(AI, query, context, langName) {
  const system =
    'Sei WidowBlue, assistente di ricerca. Rispondi SOLO in ' +
    langName +
    '. Usa ESCLUSIVAMENTE il contesto fornito. Se manca informazione, dillo. ' +
    'Sii preciso, breve (max 5 frasi). Non inventare date o fatti.';
  const user =
    'Domanda: ' + query + '\n\nContesto recuperato:\n' + context + '\n\nRisposta:';

  // @cf/meta/llama-3.1-8b-instruct is widely available on Workers AI
  const res = await AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: 512,
    temperature: 0.2,
  });

  const text =
    (res && (res.response || res.result || res.text)) ||
    (typeof res === 'string' ? res : '');
  return String(text || '').trim().slice(0, 1200);
}

async function generateWithPerplexity(apiKey, query, context, langName) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content:
            'Reply in ' +
            langName +
            '. Use ONLY the provided context. Be precise. Max 5 sentences.',
        },
        {
          role: 'user',
          content: 'Question: ' + query + '\n\nContext:\n' + context,
        },
      ],
      temperature: 0.15,
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error('perplexity ' + res.status);
  const data = await res.json();
  return (
    (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
    ''
  )
    .trim()
    .slice(0, 1200);
}

function extractiveAnswer(query, context, lang) {
  if (!context || context.length < 20) {
    return lang === 'en'
      ? 'No relevant sources found to answer this question.'
      : 'Nessuna fonte rilevante trovata per rispondere.';
  }

  // Take top passages (already ranked) and stitch first sentences
  const blocks = context.split(/\n\n\[/).map((b, i) => (i === 0 ? b : '[' + b));
  const qTokens = new Set(tokenize(query));
  const scored = [];

  for (const b of blocks) {
    const body = b.replace(/^\[\d+\][^\n]*\n/, '').replace(/\nURL:.*$/, '');
    const sentences = body.split(/(?<=[.!?])\s+/).filter((s) => s.length > 25);
    for (const s of sentences) {
      const toks = tokenize(s);
      let hit = 0;
      for (const t of toks) if (qTokens.has(t)) hit++;
      scored.push({ s: s.trim(), hit, len: s.length });
    }
  }
  scored.sort((a, b) => b.hit - a.hit || a.len - b.len);

  const picked = [];
  const seen = new Set();
  for (const item of scored) {
    const key = item.s.slice(0, 40).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(item.s);
    if (picked.length >= 3) break;
  }

  if (!picked.length) {
    // fallback: first 400 chars of context body
    const plain = context.replace(/\[\d+\][^\n]*\n/g, '').replace(/URL:.*$/gm, '').trim();
    return plain.slice(0, 500);
  }
  return picked.join(' ');
}
