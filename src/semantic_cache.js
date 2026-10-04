/**
 * WidowBlue – Semantic Cache
 * Cache risposte per query simili (token overlap + normalizzazione).
 * Usa env.WB_CACHE (KV) se disponibile, altrimenti memoria di processo.
 */

const mem = new Map();
const MAX_MEM = 80;
const TTL_MS = 15 * 60 * 1000;

function normalize(q) {
  return String(q || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

function tokens(q) {
  return new Set(normalize(q).split(' ').filter((t) => t.length > 2));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const uni = a.size + b.size - inter;
  return uni ? inter / uni : 0;
}

function cacheKey(q, lang) {
  return 'sc:' + (lang || 'it') + ':' + normalize(q).slice(0, 120);
}

export async function cacheLookup(query, opts = {}) {
  const lang = opts.lang || 'it';
  const minScore = opts.minScore ?? 0.72;
  const env = opts.env || {};
  const key = cacheKey(query, lang);
  const qTok = tokens(query);
  const now = Date.now();

  if (env.WB_CACHE && typeof env.WB_CACHE.get === 'function') {
    try {
      const exact = await env.WB_CACHE.get(key, 'json');
      if (exact && exact.answer && (!exact.exp || exact.exp > now)) {
        return { hit: true, score: 1, answer: exact.answer, key, source: 'kv-exact' };
      }
    } catch (_) {}
  }

  let best = null;
  for (const [k, v] of mem.entries()) {
    if (v.exp && v.exp < now) {
      mem.delete(k);
      continue;
    }
    if (v.lang && v.lang !== lang) continue;
    const sc = jaccard(qTok, v.tokens || tokens(v.query || ''));
    if (sc >= minScore && (!best || sc > best.score)) {
      best = { hit: true, score: sc, answer: v.answer, key: k, source: 'memory' };
    }
  }
  if (best) return best;

  return { hit: false, score: 0, answer: null, key, source: null };
}

export async function cacheStore(query, answer, opts = {}) {
  const lang = opts.lang || 'it';
  const env = opts.env || {};
  const key = cacheKey(query, lang);
  const payload = {
    query: String(query || '').slice(0, 400),
    answer: typeof answer === 'string' ? answer.slice(0, 4000) : answer,
    lang,
    tokens: [...tokens(query)],
    exp: Date.now() + TTL_MS,
    at: Date.now(),
  };

  mem.set(key, payload);
  while (mem.size > MAX_MEM) {
    const first = mem.keys().next().value;
    mem.delete(first);
  }

  if (env.WB_CACHE && typeof env.WB_CACHE.put === 'function') {
    try {
      await env.WB_CACHE.put(key, JSON.stringify(payload), { expirationTtl: Math.floor(TTL_MS / 1000) });
    } catch (_) {}
  }
  return key;
}

export function cacheStats() {
  return { memoryEntries: mem.size, ttlMs: TTL_MS, maxMem: MAX_MEM };
}
