/**
 * WidowBlue – memoria conversazionale / “learning” di sessione
 *
 * Non è ML pesante su GPU: è context learning online sulla chat:
 *  - estrae topic + entity dalla cronologia
 *  - ancora le query successive al tema
 *  - filtra risultati fuori dominio (es. Serie A ≠ Formula 1)
 */

const DOMAIN_LEX = {
  serie_a: {
    keys: [
      'serie a',
      'serie-a',
      'calcio',
      'juventus',
      'inter',
      'milan',
      'napoli',
      'roma',
      'lazio',
      'fiorentina',
      'atalanta',
      'classifica',
      'campionato italiano',
      'serie b',
      'coppa italia',
      'gol',
      'allenatore',
    ],
    boost: ['calcio', 'serie a', 'football italia'],
    ban: ['formula 1', 'formula uno', 'f1', 'motogp', 'nba', 'nfl', 'tennis'],
  },
  formula1: {
    keys: ['formula 1', 'formula uno', 'f1', 'grand prix', 'motorsport', 'ferrari f1', 'verstappen', 'hamilton'],
    boost: ['formula 1', 'f1'],
    ban: ['serie a', 'calcio', 'juventus', 'nba'],
  },
  calcio: {
    keys: ['calcio', 'champions league', 'europa league', 'premier league', 'liga', 'bundesliga'],
    boost: ['calcio', 'football'],
    ban: ['formula 1', 'f1', 'motogp'],
  },
  tech: {
    keys: ['cloudflare', 'javascript', 'python', 'api', 'software', 'programmazione', 'react', 'worker'],
    boost: [],
    ban: [],
  },
};

const STOP = new Set(
  'il lo la i gli le un una di da in con su per tra fra e o a the a an of to in on for and or is are was were che cosa come quando dove chi perché perche'.split(
    /\s+/
  )
);

export function buildConversationContext(prompt, history) {
  const p = String(prompt || '').trim();
  const hist = Array.isArray(history) ? history.slice(-16) : [];

  const topic = extractTopic(p, hist);
  const entity = extractEntity(p, hist, topic);
  const domain = detectDomain(p, hist, topic, entity);
  const followUp = isFollowUp(p, hist);

  let query = p;
  if (followUp && entity && !includesLoose(p, entity)) {
    query = entity + ' — ' + p;
  } else if (followUp && topic && !includesLoose(p, topic)) {
    query = topic + ' — ' + p;
  }

  // Ancora al dominio per evitare drift (Serie A vs F1)
  if (domain && DOMAIN_LEX[domain] && DOMAIN_LEX[domain].boost.length) {
    const b = DOMAIN_LEX[domain].boost[0];
    if (!includesLoose(query, b)) query = query + ' ' + b;
  }

  return {
    query: query.slice(0, 400),
    entity: entity || null,
    topic: topic || null,
    domain: domain || null,
    followUp,
    keywords: extractKeywords(p, hist, entity, topic),
  };
}

function includesLoose(hay, needle) {
  const h = String(hay || '').toLowerCase();
  const n = String(needle || '').toLowerCase().slice(0, 24);
  return n.length > 2 && h.includes(n);
}

function isFollowUp(p, hist) {
  if (!hist.length) return false;
  if (p.length < 80) return true;
  return /^(e |ed |ma |poi |anche |quindi |invece |però |pero |e lui|e lei|e dopo|and |but |then |also |why |how |when |where |chi |cosa |quando |dove |come )/i.test(
    p
  );
}

function extractEntity(p, hist, topic) {
  // Prefer explicit entity from recent assistant/user memory
  for (let i = hist.length - 1; i >= 0; i--) {
    const h = hist[i];
    if (h && h.entity && String(h.entity).trim().length > 2) {
      return cleanEntity(h.entity);
    }
  }
  // From recent user turns
  for (let i = hist.length - 1; i >= 0; i--) {
    const h = hist[i];
    if (h && h.role === 'user' && h.text) {
      const e = nounish(h.text);
      if (e && e.length > 2) return e;
    }
  }
  // Current prompt if not a pure follow-up pronoun
  if (!/^(e |poi |anche |quindi |perché|perche|come|quando|dove)/i.test(p)) {
    const e = nounish(p);
    if (e && e.length > 2) return e;
  }
  return topic || null;
}

function extractTopic(p, hist) {
  const bag = [];
  for (const h of hist) {
    if (h && h.text) bag.push(String(h.text));
    if (h && h.entity) bag.push(String(h.entity));
  }
  bag.push(p);
  const text = bag.join(' ').toLowerCase();

  // Domain-specific topics first
  if (/serie\s*a|juventus|inter|milan|napoli|classifica.*calcio|campionato.*calcio/i.test(text))
    return 'Serie A';
  if (/formula\s*1|formula uno|\bf1\b|grand prix/i.test(text)) return 'Formula 1';
  if (/champions league/i.test(text)) return 'Champions League';

  // Most frequent content tokens from history
  const freq = {};
  for (const h of hist) {
    for (const t of tokens(h && (h.entity || h.text))) {
      if (STOP.has(t) || t.length < 4) continue;
      freq[t] = (freq[t] || 0) + (h.entity ? 3 : 1);
    }
  }
  const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  if (ranked.length && ranked[0][1] >= 2) return ranked[0][0];
  return nounish(p);
}

function detectDomain(p, hist, topic, entity) {
  const text = [p, topic, entity]
    .concat(hist.map((h) => (h && (h.entity || h.text)) || ''))
    .join(' ')
    .toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const [name, def] of Object.entries(DOMAIN_LEX)) {
    let s = 0;
    for (const k of def.keys) if (text.includes(k)) s += 2;
    if (s > bestScore) {
      bestScore = s;
      best = name;
    }
  }
  return bestScore >= 2 ? best : null;
}

function extractKeywords(p, hist, entity, topic) {
  const set = new Set();
  for (const t of tokens(p)) if (!STOP.has(t) && t.length > 3) set.add(t);
  if (entity) for (const t of tokens(entity)) set.add(t);
  if (topic) for (const t of tokens(topic)) set.add(t);
  for (const h of hist.slice(-6)) {
    if (h && h.entity) for (const t of tokens(h.entity)) set.add(t);
  }
  return [...set].slice(0, 12);
}

function nounish(text) {
  let t = String(text || '')
    .replace(/^(quando|chi|cosa|come|dove|perché|perche|what|when|who|where|why|how)\b[\s\S]{0,24}/i, '')
    .replace(/\?+$/g, '')
    .trim();
  // Keep first 6 meaningful words
  const parts = t.split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));
  return parts.slice(0, 6).join(' ').slice(0, 80) || null;
}

function cleanEntity(e) {
  return String(e || '')
    .replace(/\s*\([A-Z]{2}\)\s*$/i, '')
    .replace(/^Sintesi\s+\w+/i, '')
    .trim()
    .slice(0, 80);
}

function tokens(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Filtra / riordina risultati tenendo il dominio della conversazione.
 * Es: se domain=serie_a, penalizza pesantemente Formula 1.
 */
export function filterResultsByContext(results, ctx) {
  const list = Array.isArray(results) ? results.slice() : [];
  if (!ctx) return list;

  const domain = ctx.domain;
  const keys = (ctx.keywords || []).map((k) => k.toLowerCase());
  const entity = (ctx.entity || '').toLowerCase();
  const topic = (ctx.topic || '').toLowerCase();

  const ban = domain && DOMAIN_LEX[domain] ? DOMAIN_LEX[domain].ban : [];
  const boost = domain && DOMAIN_LEX[domain] ? DOMAIN_LEX[domain].boost : [];

  const scored = list.map((r) => {
    const blob = ((r.title || '') + ' ' + (r.snippet || '') + ' ' + (r.url || '')).toLowerCase();
    let score = r._score || 0;

    for (const b of ban) {
      if (blob.includes(b)) score -= 40;
    }
    for (const b of boost) {
      if (blob.includes(b)) score += 15;
    }
    if (entity && blob.includes(entity.slice(0, 12))) score += 25;
    if (topic && blob.includes(topic.slice(0, 12))) score += 18;
    for (const k of keys) {
      if (k.length > 3 && blob.includes(k)) score += 4;
    }

    // Hard drop if banned domain dominates and no topic match
    let hardBan = false;
    if (ban.length) {
      const hitBan = ban.some((b) => blob.includes(b));
      const hitTopic = (entity && blob.includes(entity.slice(0, 8))) || (topic && blob.includes(topic.slice(0, 8)));
      if (hitBan && !hitTopic) hardBan = true;
    }

    return { r, score, hardBan };
  });

  return scored
    .filter((x) => !x.hardBan)
    .sort((a, b) => b.score - a.score)
    .map((x) => {
      x.r._score = x.score;
      return x.r;
    });
}
