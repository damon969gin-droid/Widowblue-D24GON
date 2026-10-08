/**
 * WidowBlue – RAG + sintesi multilanguage
 * LLM predefinito: OpenRouter (OPEN_ROUTER_API_KEY)
 * Chunking con overlap + force lingua target.
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
    if (lang && lang !== 'auto') {
      cleanText = await forceLang(cleanText, lang);
      cleanText = polish(cleanText, lang);
    }
  } catch (_) {}

  return {
    ok: true,
    query: q,
    deep,
    lang,
    answer: {
      text: cleanText,
      provider: generation.provider,
      grounded: generation.provider !== 'empty',
      citations: generation.citations || [],
    },
    rag: {
      chunks: ranked.length,
      sources,
      contextChars: contextPack.length,
    },
    search: searchPrimary,
    results: (searchPrimary && searchPrimary.results) || docs.slice(0, 8),
    fetchedAt: Date.now(),
  };
}

async function deepRetrieve(q, opts) {
  const primary = await modularSearch(q, opts);
  const docs = (primary.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet || r.text || '',
    provider: r.provider,
    kind: r.kind,
  }));
  return { primary, docs };
}

function chunkDocuments(docs) {
  const out = [];
  for (const d of docs || []) {
    const raw = String(d.snippet || '').trim();
    if (!raw) continue;
    const size = 420;
    const overlap = 60;
    if (raw.length <= size) {
      out.push({ title: d.title, url: d.url, provider: d.provider, text: raw, score: 0 });
      continue;
    }
    let i = 0;
    while (i < raw.length) {
      const piece = raw.slice(i, i + size).trim();
      if (piece.length > 40) {
        out.push({ title: d.title, url: d.url, provider: d.provider, text: piece, score: 0 });
      }
      i += size - overlap;
      if (out.length > 40) break;
    }
  }
  return out;
}

function rankChunks(query, chunks) {
  const qTokens = String(query || '')
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  return chunks
    .map((c) => {
      const t = (c.text + ' ' + (c.title || '')).toLowerCase();
      let s = 0;
      for (const tok of qTokens) if (t.includes(tok)) s += 1;
      c.score = s / Math.max(1, qTokens.length);
      return c;
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0));
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
      ' Continuita conversazione: resta sul filo gia aperto' +
      (opts.entity || opts.topic
        ? ' (tema: ' + [opts.entity, opts.topic].filter(Boolean).join(' / ') + ')'
        : '') +
      (opts.summary ? '. Contesto recente: ' + String(opts.summary).slice(0, 400) : '') +
      '. Se la domanda e breve, interpretala in questo contesto.';
  }

  const system =
    'Sei WidowBlue, un assistente utile e diretto. Parli come una persona reale: chiaro, naturale, senza formalismi inutili. ' +
    'LINGUA: rispondi SOLO in ' +
    langLabel +
    '. Non mischiare lingue. ' +
    'STILE: ' +
    '1) Inizia subito con la risposta utile, senza preamboli ("Certo!", "Ottima domanda", "Secondo le fonti"). ' +
    '2) Frasi scorrevoli e concrete; preferisci 3-6 frasi ben collegate (di piu se la domanda lo richiede). ' +
    '3) Spiega con parole semplici; se serve un termine tecnico, chiariscilo in una mezza riga. ' +
    '4) Usa i fatti raccolti ma riscrivili con parole tue: zero copia-incolla di snippet, zero elenchi di link nel testo. ' +
    '5) Se non sei sicuro o i dati sono parziali, dillo in modo onesto e breve. ' +
    '6) Non citare provider, RAG, pipeline, modelli o "secondo le fonti/web". ' +
    '7) Tono amichevole e competente, come un collega che sa di cosa parla. ' +
    '8) Continuita: se c\'e un filo di chat, resta su quell\'argomento. ' +
    topicHint;

  const userMsg =
    'Domanda:\n' +
    query +
    '\n\nFatti utili (riscrivi, non copiare):\n' +
    context +
    '\n\nRispondi in ' +
    langLabel +
    ' in modo naturale e diretto:';

  // OpenRouter predefinito (OPEN_ROUTER_API_KEY)
  if (env.OPEN_ROUTER_API_KEY && context.length > 40) {
    try {
      const text = await generateWithOpenRouter(env.OPEN_ROUTER_API_KEY, system, userMsg, env.OPENROUTER_MODEL);
      if (text && text.length > 25) {
        return { text: polish(text, lang), provider: 'openrouter', title: '', citations: cited.map((c) => c.id) };
      }
    } catch (e) {}
  }

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
    if (env.OPEN_ROUTER_API_KEY && context.length > 40) {
      try {
        const refined = await generateWithOpenRouter(
          env.OPEN_ROUTER_API_KEY,
          system + ' Riscrivi questa bozza in ' + langLabel + ' con tono naturale e fluido, come se la spiegassi a voce a un amico competente. Niente elenchi di fonti:',
          'Domanda: ' + query + '\n\nBozza:\n' + synth + '\n\nRisposta riscritta in ' + langLabel + ':',
          env.OPENROUTER_MODEL
        );
        if (refined && refined.length > 15) {
          return { text: polish(refined, lang), provider: 'openrouter', title: '', citations: cited.map((c) => c.id) };
        }
      } catch (e) {}
    }
    if (env.AI && context.length > 40) {
      try {
        const refined = await generateWithWorkersAI(
          env.AI,
          system + ' Riscrivi questa bozza in ' + langLabel + ' con tono naturale e fluido, come se la spiegassi a voce a un amico competente. Niente elenchi di fonti:',
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

async function generateWithOpenRouter(apiKey, system, user, model) {
  const m = String(model || '').trim() || 'google/gemini-2.0-flash-exp:free';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'HTTP-Referer': 'https://widowblue.app',
      'X-Title': 'WidowBlue',
    },
    body: JSON.stringify({
      model: m,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.45,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error('openrouter ' + res.status + ' ' + String(errBody).slice(0, 120));
  }
  const data = await res.json();
  return ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '')
    .trim()
    .slice(0, 2400);
}

async function generateWithWorkersAI(AI, system, user) {
  const res = await AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: 1000,
    temperature: 0.45,
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
      temperature: 0.4,
      max_tokens: 1000,
    }),
  });
  if (!res.ok) throw new Error('perplexity ' + res.status);
  const data = await res.json();
  return ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '')
    .trim()
    .slice(0, 2400);
}
