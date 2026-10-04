/**
 * WidowBlue – RAG + sintesi multilanguage
 * Chunking con overlap per retrieval più robusto.
 */

import { modularSearch } from './search.js';
import { filterResultsByContext } from './context.js';
import { synthesizeAnswer, expandForIntent, polish } from './answer.js';
import { langName, noAnswerMsg, detectLang, translateText, forceLang } from './lang.js';

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
    summary: convCtx && convCtx.summary,
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

  let cleanText = polish(generation.text, lang);
  try {
    if (typeof forceLang === 'function') {
      cleanText = await forceLang(cleanText, lang);
      cleanText = polish(cleanText, lang);
    } else {
      const detected = detectLang(cleanText);
      if (lang && lang !== 'auto' && detected !== lang && cleanText.length > 40) {
        const tr = await translateText(cleanText.slice(0, 450), detected, lang);
        if (tr && tr.length > 30) cleanText = polish(tr, lang);
      }
    }
  } catch (_) {}

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
    policy: { respectful: true, grounded: true, reasoned: true },
    fetchedAt: Date.now(),
  };
}

async function deepRetrieve(q, { deep, env, lang }) {
  const queries = [q];
  for (const v of expandForIntent(q, lang)) {
    if (!queries.includes(v) && v.length > 3) queries.push(v);
  }
  if (deep) {
    for (const v of expandQueries(q, lang)) {
      if (!queries.includes(v) && v.length > 3) queries.push(v);
    }
  }

  const primary = await modularSearch(q, { deep: true, env, lang });
  const docs = [...(primary.results || [])];
  const seen = new Set(docs.map((d) => (d.url || d.title || '').toLowerCase()).filter(Boolean));

  const extras = queries.slice(1, 3);
  if (extras.length) {
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

  return { docs, primary, queries };
}

function expandQueries(q, lang) {
  const base = q.replace(/\?+$/, '').trim();
  const out = [];
  if (lang === 'it') {
    out.push(base + ' oggi');
    if (/quando|nato|nascita/i.test(base)) out.push(base.replace(/quando\s+/i, '') + ' data di nascita');
    if (/chi è|chi e/i.test(base)) out.push(base.replace(/chi\s+[eè]\s+/i, '') + ' biografia');
  } else {
    out.push(base + ' today');
  }
  return out.slice(0, 2);
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
  // Chunking con overlap ~15% per non spezzare contesti RAG
  if (!text) return [];
  const max = maxLen || 360;
  const overlap = Math.min(80, Math.floor(max * 0.15));
  if (text.length <= max) return [text];
  const sentences = text.split(/(?<=[.!?。])\s+/).filter(Boolean);
  const parts = [];
  let buf = '';
  for (const s of sentences) {
    const next = buf ? buf + ' ' + s : s;
    if (next.length > max) {
      if (buf) parts.push(buf.trim());
      if (buf && overlap > 0) {
        const tail = buf.slice(-overlap);
        buf = tail + ' ' + s;
        if (buf.length > max) buf = s;
      } else {
        buf = s;
      }
    } else {
      buf = next;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  const final = [];
  for (const p of parts) {
    if (p.length <= max) final.push(p);
    else {
      for (let i = 0; i < p.length; i += max - overlap) {
        final.push(p.slice(i, i + max));
        if (final.length >= 8) break;
      }
    }
    if (final.length >= 8) break;
  }
  return final.slice(0, 8);
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
    if (/classifica|standings|live/i.test((c.title || '') + (c.text || ''))) score *= 1.3;
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
  const langLabel = langName(lang);

  let topicHint = '';
  if (opts.topic || opts.entity || opts.summary) {
    topicHint =
      ' MEMORIA CHAT: resta coerente con il filo gia discusso. ' +
      (opts.entity || opts.topic
        ? 'Argomento in corso: ' + [opts.entity, opts.topic].filter(Boolean).join(' / ') + '. '
        : '') +
      (opts.summary ? 'Contesto recente: ' + String(opts.summary).slice(0, 500) + '. ' : '') +
      'Se la domanda e breve o vaga, interpreta rispetto a questo argomento, senza cambiare tema.';
  }

  const system =
    'Sei un assistente intelligente che risponde al cliente con un ragionamento chiaro e naturale. ' +
    'Lingua obbligatoria: ' + langLabel + '. Scrivi TUTTA la risposta solo in ' + langLabel + ', mai in altre lingue. ' +
    'REGOLE: ' +
    '1) NON copiare le fonti e NON elencare snippet web. ' +
    '2) Leggi le informazioni, ragiona e SCRIVI una risposta originale con parole tue. ' +
    '3) Rispondi DIRETTAMENTE alla domanda del cliente (sintesi + spiegazione). ' +
    '4) Tono conversazionale e professionale, come un collega esperto (2-8 frasi, di piu se serve). ' +
    '5) Se i fatti sono incompleti, dillo in modo trasparente. ' +
    '6) Non menzionare provider, RAG, pipeline, "secondo le fonti". ' +
    '7) Non mischiare lingue. ' +
    '8) Usa la memoria della chat: se il cliente continua un tema, rispondi su quello anche se non lo ripete. ' +
    topicHint;

  const userMsg =
    'Domanda del cliente:\n' +
    query +
    '\n\nInformazioni raccolte (usale solo come base di fatti, non copiarle):\n' +
    context +
    '\n\nScrivi ora la tua risposta ragionata in ' +
    langLabel +
    ', rivolta al cliente, in linguaggio naturale:';

  if (env.AI && context.length > 40) {
    try {
      const text = await generateWithWorkersAI(env.AI, system, userMsg);
      if (text && text.length > 25) {
        return { text: polish(text, lang), provider: 'workers-ai', title: '', citations: cited.map((c) => c.id) };
      }
    } catch (e) {}
  }

  if (env.PERPLEXITY_API_KEY && context.length > 40) {
    try {
      const text = await generateWithPerplexity(env.PERPLEXITY_API_KEY, system, userMsg);
      if (text && text.length > 25) {
        return { text: polish(text, lang), provider: 'perplexity', title: '', citations: cited.map((c) => c.id) };
      }
    } catch (e) {}
  }

  const synth = synthesizeAnswer(query, cited, opts.priorAnswer, lang);
  if (synth && synth.length > 20) {
    if (env.AI && context.length > 40) {
      try {
        const refined = await generateWithWorkersAI(
          env.AI,
          system + ' Riscrivi la bozza in forma piu naturale e ragionata, senza copiare:',
          'Domanda: ' + query + '\n\nBozza:\n' + synth + '\n\nRisposta riscritta in ' + langLabel + ':'
        );
        if (refined && refined.length > 15) {
          return { text: polish(refined, lang), provider: 'workers-ai', title: '', citations: cited.map((c) => c.id) };
        }
      } catch (e) {}
    }
    return { text: polish(synth, lang), provider: 'synth', title: '', citations: cited.map((c) => c.id) };
  }

  if (opts.priorAnswer && opts.priorAnswer.text) {
    return { text: polish(opts.priorAnswer.text, lang), provider: 'retrieve', title: '', citations: cited.slice(0, 3).map((c) => c.id) };
  }

  return { text: noAnswerMsg(lang), provider: 'empty', title: '', citations: [] };
}

async function generateWithWorkersAI(AI, system, user) {
  const res = await AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: 1000,
    temperature: 0.35,
  });
  const text = (res && (res.response || res.result || res.text)) || (typeof res === 'string' ? res : '');
  return String(text || '').trim().slice(0, 2400);
}

async function generateWithPerplexity(apiKey, system, user) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });
  if (!res.ok) throw new Error('perplexity ' + res.status);
  const data = await res.json();
  return ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '')
    .trim()
    .slice(0, 2400);
}
