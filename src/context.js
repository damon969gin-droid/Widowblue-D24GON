/**
 * WidowBlue – memoria conversazionale di sessione
 *
 * Tiene traccia di topic / entity / dominio e ancora ogni messaggio
 * al filo già discusso, così i follow-up restano naturali e pertinenti
 * anche senza ripetere l'argomento.
 */

const DOMAIN_LEX = {
  serie_a: {
    keys: [
      'serie a', 'serie-a', 'calcio', 'juventus', 'inter', 'milan', 'napoli',
      'roma', 'lazio', 'fiorentina', 'atalanta', 'classifica', 'campionato italiano',
      'serie b', 'coppa italia', 'gol', 'allenatore', 'punti', 'capolista',
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
    keys: ['calcio', 'champions league', 'europa league', 'premier league', 'liga', 'bundesliga', 'mondiali'],
    boost: ['calcio', 'football'],
    ban: ['formula 1', 'f1', 'motogp'],
  },
  tech: {
    keys: [
      'cloudflare', 'javascript', 'python', 'api', 'software', 'programmazione',
      'react', 'worker', 'ai', 'llm', 'machine learning', 'rag', 'agente',
    ],
    boost: [],
    ban: [],
  },
  scienza: {
    keys: ['fisica', 'chimica', 'biologia', 'astronomia', 'medicina', 'clima'],
    boost: [],
    ban: [],
  },
  economia: {
    keys: ['economia', 'mercato', 'borsa', 'inflazione', 'pil', 'finanza', 'cripto', 'bitcoin'],
    boost: [],
    ban: [],
  },
};

const STOP = new Set(
  'il lo la i gli le un una di da in con su per tra fra e o a the a an of to in on for and or is are was were che cosa come quando dove chi perché perche questo questa questi queste quello quella quelli quelle si no non mi ti ci vi suo sua suoi sue mio mia miei mie tuo tua'
    .split(/\s+/)
);

const SWITCH_RE =
  /^(parliamo\s+di|cambi[oa]\s+(argomento|tema)|invece\s+di|ora\s+parliamo|new topic|talk about|regarding something else)/i;

export function buildConversationContext(prompt, history) {
  const p = String(prompt || '').trim();
  const hist = Array.isArray(history) ? history.slice(-40) : [];

  const topic = extractTopic(p, hist);
  const entity = extractEntity(p, hist, topic);
  const domain = detectDomain(p, hist, topic, entity);
  const followUp = isFollowUp(p, hist);
  const summary = buildSummary(hist, topic, entity);

  let query = p;

  if (hist.length && !SWITCH_RE.test(p)) {
    if (followUp || p.length < 140) {
      if (entity && !includesLoose(p, entity)) {
        query = entity + ' — ' + p;
      } else if (topic && !includesLoose(p, topic)) {
        query = topic + ' — ' + p;
      }
    } else if (entity && isVague(p) && !includesLoose(p, entity)) {
      query = entity + ' — ' + p;
    }
  }

  if (domain && DOMAIN_LEX[domain] && DOMAIN_LEX[domain].boost.length) {
    const b = DOMAIN_LEX[domain].boost[0];
    if (!includesLoose(query, b)) query = query + ' ' + b;
  }

  return {
    query: query.slice(0, 420),
    entity: entity || null,
    topic: topic || null,
    domain: domain || null,
    followUp,
    summary: summary || null,
    keywords: extractKeywords(p, hist, entity, topic),
  };
}

function isVague(p) {
  return /^(dimmi di pi[uù]|continua|e poi|e dopo|approfondisci|spiega meglio|perch[eé]|come|quando|dove|chi|cosa|e\?|and\?|why|how|more|tell me more|go on)/i.test(
    String(p || '').trim()
  );
}

function includesLoose(hay, needle) {
  const h = String(hay || '').toLowerCase();
  const n = String(needle || '')
    .toLowerCase()
    .slice(0, 28);
  return n.length > 2 && h.includes(n);
}

function isFollowUp(p, hist) {
  if (!hist.length) return false;
  if (SWITCH_RE.test(p)) return false;
  const s = String(p || '').trim();
  if (s.length < 120) return true;
  if (s.split(/\s+/).length <= 12) return true;
  if (
    /^(e |ed |ma |poi |anche |quindi |invece |però |pero |e lui|e lei|e dopo|and |but |then |also |why |how |when |where |chi |cosa |quando |dove |come |perch|dimmi|spiega|continua|approfond|e di |e il |e la )/i.test(
      s
    )
  ) {
    return true;
  }
  if (/\b(lui|lei|loro|quello|quella|questo|questa|ne |ci |lo |la |li |le |it|they|he|she|this|that|the same|stesso|stessa)\b/i.test(s)) {
    return true;
  }
  const last = hist.slice(-6).map((h) => String((h && (h.entity || h.topic || h.text)) || '').toLowerCase()).join(' ');
  const toks = s.toLowerCase().split(/[^a-zA-Z0-9àèéìòù]+/).filter((t) => t.length > 3);
  let hit = 0;
  for (const t of toks) if (last.includes(t)) hit++;
  if (toks.length >= 2 && hit / toks.length >= 0.3) return true;
  return false;
}

function extractEntity(p, hist, topic) {
  for (let i = hist.length - 1; i >= 0; i--) {
    const h = hist[i];
    if (h && h.entity && String(h.entity).trim().length > 2) {
      return cleanEntity(h.entity);
    }
  }
  for (let i = hist.length - 1; i >= 0; i--) {
    const h = hist[i];
    if (h && h.role === 'assistant' && h.text) {
      const e = nounish(h.text);
      if (e && e.length > 2) return e;
    }
  }
  for (let i = hist.length - 1; i >= 0; i--) {
    const h = hist[i];
    if (h && h.role === 'user' && h.text) {
      const e = nounish(h.text);
      if (e && e.length > 2) return e;
    }
  }
  if (!/^(e |poi |anche |quindi |perché|perche|come|quando|dove|dimmi|continua)/i.test(p)) {
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
    if (h && h.topic) bag.push(String(h.topic));
  }
  bag.push(p);
  const text = bag.join(' ').toLowerCase();

  if (/serie\s*a|juventus|inter|milan|napoli|classifica.*calcio|campionato.*calcio/i.test(text))
    return 'Serie A';
  if (/formula\s*1|formula uno|\bf1\b|grand prix/i.test(text)) return 'Formula 1';
  if (/champions league/i.test(text)) return 'Champions League';
  if (/intelligenza artificiale|\bllm\b|\bagenti?\s*ai\b|machine learning/i.test(text))
    return 'Intelligenza artificiale';
  if (/cloudflare|javascript|python|react|programmazione/i.test(text)) return 'Tecnologia';

  const freq = {};
  for (const h of hist) {
    for (const t of tokens(h && (h.entity || h.topic || h.text))) {
      if (STOP.has(t) || t.length < 4) continue;
      freq[t] = (freq[t] || 0) + (h.entity || h.topic ? 3 : 1);
    }
  }
  const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  if (ranked.length && ranked[0][1] >= 2) return ranked[0][0];
  return nounish(p);
}

function detectDomain(p, hist, topic, entity) {
  const text = [p, topic, entity]
    .concat(hist.map((h) => (h && (h.entity || h.topic || h.text)) || ''))
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
  for (const h of hist.slice(-8)) {
    if (h && h.entity) for (const t of tokens(h.entity)) set.add(t);
    if (h && h.topic) for (const t of tokens(h.topic)) set.add(t);
  }
  return [...set].slice(0, 14);
}

function buildSummary(hist, topic, entity) {
  if (!hist || !hist.length) return null;
  const parts = [];
  if (entity) parts.push('Entità principale: ' + entity);
  if (topic && topic !== entity) parts.push('Tema: ' + topic);
  const users = hist.filter((h) => h && h.role === 'user').slice(-5);
  const assts = hist.filter((h) => h && h.role === 'assistant').slice(-4);
  if (users.length) {
    parts.push('Domande recenti: ' + users.map((h) => String(h.text || '').slice(0, 120)).join(' | '));
  }
  if (assts.length) {
    parts.push('Risposte chiave: ' + assts.map((h) => String(h.text || '').slice(0, 160)).join(' | '));
  }
  const ents = [];
  for (const h of hist.slice(-12)) {
    if (h && h.entity && !ents.includes(h.entity)) ents.push(h.entity);
    if (h && h.topic && !ents.includes(h.topic)) ents.push(h.topic);
  }
  if (ents.length) parts.push('Filo discusso: ' + ents.slice(0, 8).join(', '));
  const out = parts.join('. ').replace(/\s+/g, ' ').trim();
  return out.slice(0, 900) || null;
}

function nounish(text) {
  let t = String(text || '')
    .replace(/^(quando|chi|cosa|come|dove|perché|perche|what|when|who|where|why|how|dimmi|spiega)\b[\s\S]{0,24}/i, '')
    .replace(/\?+$/g, '')
    .trim();
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

    let hardBan = false;
    if (ban.length) {
      const hitBan = ban.some((b) => blob.includes(b));
      const hitTopic =
        (entity && blob.includes(entity.slice(0, 8))) || (topic && blob.includes(topic.slice(0, 8)));
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
