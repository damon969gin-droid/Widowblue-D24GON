import { noAnswerMsg, detectLang } from './lang.js';
import { AI_GLOSSARY, GLOSSARY_ALIASES } from './ai_terms.js';
/**
 * WidowBlue – motore di risposta chat
 * Sintesi ragionata e naturale (non copia web).
 * Glossario tecnico: vedi src/ai_terms.js (elenco completo architetture/training/infra/RAG/agenti/safety).
 */

const TEAMS_IT = [
  'Napoli','Inter','Milan','Juventus','Roma','Lazio','Atalanta','Fiorentina',
  'Bologna','Torino','Genoa','Como','Udinese','Cagliari','Parma','Lecce',
  'Empoli','Venezia','Monza','Verona','Sassuolo','Cremonese','Pisa','Spezia',
];

function glossaryAnswer(query, lang) {
  const ql = String(query || '');
  const code = String(lang || 'it').slice(0, 2);
  for (const [key, re] of GLOSSARY_ALIASES) {
    if (re.test(ql) && AI_GLOSSARY[key]) return AI_GLOSSARY[key][code] || AI_GLOSSARY[key].it;
  }
  return null;
}

export function synthesizeAnswer(query, cited, priorAnswer, lang) {
  const ql = String(query || '').toLowerCase();
  const langCode = String(lang || 'it').slice(0, 2);

  if (/classifica|primo|leader|in testa|capolista|standings|top of the table/i.test(ql)) {
    const stand = extractStandings(cited, priorAnswer);
    if (stand) return polish(stand, langCode);
  }

  const gloss = glossaryAnswer(query, langCode);
  if (gloss) {
    const fromSources = extractive(query, cited);
    if (fromSources && fromSources.length > 40) return polish(mergeDeep(gloss, fromSources, langCode), langCode);
    return polish(gloss, langCode);
  }

  if (priorAnswer && priorAnswer.text && priorAnswer.text.length > 30) {
    let t = priorAnswer.text;
    if (/classifica|primo|serie a|capolista|standings/i.test(ql)) {
      const stand = extractStandingsFromText(t + ' ' + (cited || []).map((c) => c.text || '').join(' '));
      if (stand) return polish(stand, langCode);
    }
    return polish(naturalize(query, deepenFromSources(query, t, cited, langCode), langCode), langCode);
  }

  const ext = extractive(query, cited);
  if (ext) return polish(naturalize(query, deepenFromSources(query, ext, cited, langCode), langCode), langCode);

  return noAnswerMsg(langCode);
}

function naturalize(query, text, lang) {
  let t = String(text || '').trim();
  if (!t) return t;
  t = t.replace(/^Sintesi\s+\w+[.:]?\s*/i, '');
  const sentences = t.split(/(?<=[.!?])\s+/).filter((s) => s.length > 25);
  if (sentences.length >= 2) {
    const qTok = tokenize(query);
    const scored = sentences.map((s) => {
      const st = tokenize(s);
      let hit = 0;
      for (const x of qTok) if (st.has(x)) hit++;
      return { s, hit, len: s.length };
    });
    scored.sort((a, b) => b.hit - a.hit || b.len - a.len);
    const picked = [];
    const seen = new Set();
    for (const item of scored) {
      const k = item.s.slice(0, 36).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      picked.push(item.s.trim());
      if (picked.length >= 4) break;
    }
    if (picked.length) t = picked.join(' ');
  }
  return t;
}

function mergeDeep(core, extra, lang) {
  const e = String(extra || '').trim();
  if (!e) return core;
  if (lang === 'en') return core + ' ' + e.slice(0, 500);
  return core + ' ' + e.slice(0, 500);
}

function deepenFromSources(query, base, cited, lang) {
  let out = String(base || '').trim();
  const more = extractive(query, cited);
  if (more && more.length > 40) {
    const b = out.toLowerCase();
    const sentences = more.split(/(?<=[.!?])\s+/).filter((s) => s.length > 30);
    for (const s of sentences) {
      if (b.includes(s.slice(0, 30).toLowerCase())) continue;
      if (out.length > 900) break;
      out += (out.endsWith('.') ? ' ' : '. ') + s.trim();
    }
  }
  return out;
}

function extractStandings(cited, prior) {
  const blobs = [];
  if (prior && prior.text) blobs.push(prior.text);
  for (const c of cited || []) {
    if (c && c.text) blobs.push(c.text);
    if (c && c.title) blobs.push(c.title);
  }
  for (const b of blobs) {
    const s = extractStandingsFromText(b);
    if (s) return s;
  }
  return null;
}

function extractStandingsFromText(text) {
  const t = String(text || '');
  if (!t) return null;
  const leaders = [];
  for (const team of TEAMS_IT) {
    const re = new RegExp('\\b' + team + '\\b[^.]{0,40}?(\\d{1,2})\\s*(?:punti|pts?|points)', 'i');
    const m = t.match(re);
    if (m) leaders.push({ team, pts: parseInt(m[1], 10) });
  }
  let m;
  const reEn = /\b([A-Z][a-z]+)\s+(?:with|on)\s+(\d{1,2})\s+points/gi;
  const allowed = new Set(TEAMS_IT.map((x) => x.toLowerCase()));
  while ((m = reEn.exec(t))) {
    if (!allowed.has(m[1].toLowerCase())) continue;
    leaders.push({ team: m[1], pts: parseInt(m[2], 10) });
  }
  const map = {};
  for (const L of leaders) {
    if (!L.team || isNaN(L.pts)) continue;
    const key = L.team.toLowerCase();
    if (!map[key] || map[key].pts < L.pts) map[key] = L;
  }
  const ranked = Object.values(map).sort((a, b) => b.pts - a.pts);
  if (ranked.length >= 1) {
    const top = ranked[0];
    if (ranked.length >= 2 && ranked[1].pts === top.pts) {
      const same = ranked.filter((x) => x.pts === top.pts).map((x) => x.team);
      return 'In classifica di Serie A, al momento in testa a pari merito ci sono ' + same.join(', ') + ' con ' + top.pts + ' punti.';
    }
    let out = 'In classifica di Serie A, al momento è prima ' + top.team + ' con ' + top.pts + ' punti';
    if (ranked[1]) {
      out += ', seguita da ' + ranked[1].team + ' (' + ranked[1].pts + ' punti)';
      if (ranked[2]) out += ' e ' + ranked[2].team + ' (' + ranked[2].pts + ' punti)';
    }
    out += '.';
    return out;
  }
  const cap = t.match(/(?:capolista|in testa|leader)\s*[:=]?\s*([A-ZÀ-Ú][a-zà-ú]+)/i);
  if (cap && allowed.has(cap[1].toLowerCase())) {
    return 'In Serie A, al momento risulta in testa ' + cap[1] + '.';
  }
  return null;
}

function extractive(query, cited) {
  if (!cited || !cited.length) return '';
  const qTokens = tokenize(query);
  const scored = [];
  for (const c of cited) {
    const sentences = String(c.text || '').split(/(?<=[.!?])\s+/).filter((s) => s.length > 25);
    for (const s of sentences) {
      const toks = tokenize(s);
      let hit = 0;
      for (const t of toks) if (qTokens.has(t)) hit++;
      if (hit === 0 && qTokens.size) continue;
      scored.push({ s: s.trim(), hit });
    }
  }
  scored.sort((a, b) => b.hit - a.hit);
  const picked = [];
  const seen = new Set();
  for (const item of scored) {
    const k = item.s.slice(0, 40).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    picked.push(item.s);
    if (picked.length >= 5) break;
  }
  return picked.join(' ');
}

function tokenize(s) {
  return new Set(
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

export function polish(text, lang) {
  let t = String(text || '').trim();
  t = t.replace(/#{1,6}\s*/g, '');
  t = t.replace(/\[\.\.\.\]/g, ' ');
  t = t.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1');
  t = t.replace(/What Are [^?\n]+\?/gi, '');
  t = t.replace(/\b([A-ZÀ-Ú][a-zà-ú]{2,})\s+\1\b/g, '$1');
  t = t.replace(/The sources do not provide[^.]*\./gi, '');
  t = t.replace(/According to the sources[,:]?/gi, '');
  t = t.replace(/as of today's date[,:]?/gi, '');
  t = t.replace(/\b(partial standings|overall winner|definitive answer)\b/gi, '');
  t = t.replace(/\b(extractive|grounded|RAG|pipeline|provider|Workers AI|system prompt)\b/gi, '');
  t = t.replace(/\b(Sintesi\s+(Tavily|Serper|Perplexity|Google))\b/gi, '');
  t = t.replace(/\b(Based on the (search results|information|data)[,:]?)\s*/gi, '');
  t = t.replace(/\b(From the sources|Dalle fonti|Secondo le fonti)[,:]?\s*/gi, '');
  t = t.replace(/\beach\s+a\b/gi, 'con');
  t = t.replace(/\beach\s+with\b/gi, 'con');
  t = t.replace(/,\s*each\b/gi, '');
  if (lang === 'it') {
    t = t.replace(/\bpoints\b/gi, 'punti');
    t = t.replace(/\bfollowed by\b/gi, 'seguita da');
    const stand = extractStandingsFromText(t);
    if (stand && /classifica|serie|punti|capolista|primo/i.test(t)) return stand;
    const enMarkers = (t.match(/\b(the|and|with|from|followed|according|sources|does not|provide|which)\b/gi) || []).length;
    const itMarkers = (t.match(/\b(il|la|di|con|punti|seguita|secondo|classifica|prima|è|sono|della)\b/gi) || []).length;
    if (enMarkers > itMarkers + 2) {
      const gloss = glossaryAnswer(t, 'it');
      if (gloss) return gloss;
    }
  }
  t = t.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (t.length > 1800) {
    const cut = t.slice(0, 1800);
    const last = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
    if (last > 400) t = cut.slice(0, last + 1);
    else t = cut;
  }
  return t;
}

export function expandForIntent(q, lang) {
  const base = String(q || '').trim();
  const out = [];
  if (/classifica|primo|capolista|in testa/i.test(base)) {
    if (/serie\s*a/i.test(base) || /calcio/i.test(base)) {
      out.push('classifica Serie A aggiornata oggi');
      out.push('Serie A classifica live capolista');
    } else {
      out.push(base + ' aggiornata oggi');
    }
  }
  return out;
}
