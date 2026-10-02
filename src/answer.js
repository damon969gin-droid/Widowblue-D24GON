/**
 * WidowBlue – sintesi risposte stile assistente (Claude-like)
 * - Risposta diretta, in lingua utente
 * - Estrazione classifica / leader
 * - Nessun meta, niente inglese se lang=it
 */

const TEAMS_IT = [
  'Napoli',
  'Inter',
  'Milan',
  'Juventus',
  'Roma',
  'Lazio',
  'Atalanta',
  'Fiorentina',
  'Bologna',
  'Torino',
  'Genoa',
  'Como',
  'Udinese',
  'Cagliari',
  'Parma',
  'Lecce',
  'Empoli',
  'Venezia',
  'Monza',
  'Verona',
  'Sassuolo',
  'Cremonese',
  'Pisa',
  'Spezia',
];

export function synthesizeAnswer(query, cited, priorAnswer, lang) {
  const ql = String(query || '').toLowerCase();
  const langCode = String(lang || 'it').slice(0, 2);

  // 1) Classifica / chi è primo
  if (/classifica|primo|leader|in testa|capolista|standings|top of the table/i.test(ql)) {
    const stand = extractStandings(cited, priorAnswer);
    if (stand) {
      return polish(stand, langCode);
    }
  }

  // 2) Prior web summary (Tavily/Serper) – pulito e in lingua
  if (priorAnswer && priorAnswer.text && priorAnswer.text.length > 30) {
    let t = priorAnswer.text;
    if (/classifica|primo|serie a/i.test(ql)) {
      const stand = extractStandingsFromText(t);
      if (stand) return polish(stand, langCode);
    }
    return polish(t, langCode);
  }

  // 3) Extractive dalle fonti
  const ext = extractive(query, cited);
  if (ext) return polish(ext, langCode);

  return langCode === 'en'
    ? 'I could not find a reliable answer from the available sources.'
    : 'Non ho trovato una risposta chiara e aggiornata nelle fonti disponibili.';
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

  // Pattern: Team 13 punti / Team with 13 points / 1. Team 13
  const leaders = [];
  const reList = [
    /(?:^|[\s,;])([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)\s+(?:con\s+)?(\d{1,2})\s*(?:punti|pts?|points)/gi,
    /(\d{1,2})[°.\)]\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)\s*[–\-—]?\s*(\d{1,2})\s*(?:punti|pts?)?/gi,
    /(?:capolista|in testa|leader|first)\s*[:=]?\s*([A-ZÀ-Ú][a-zà-ú]+)/i,
  ];

  for (const team of TEAMS_IT) {
    const re = new RegExp(
      '\\b' + team + '\\b[^.]{0,40}?(\\d{1,2})\\s*(?:punti|pts?|points)',
      'i'
    );
    const m = t.match(re);
    if (m) leaders.push({ team, pts: parseInt(m[1], 10) });
  }

  // Also generic "Roma with 13 points"
  let m;
  const reEn = /\b([A-Z][a-z]+)\s+(?:with|on)\s+(\d{1,2})\s+points/gi;
  while ((m = reEn.exec(t))) {
    leaders.push({ team: m[1], pts: parseInt(m[2], 10) });
  }

  // Dedupe by team, keep max pts
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
      return (
        'In classifica di Serie A, al momento in testa ci sono ' +
        same.join(', ') +
        ' a ' +
        top.pts +
        ' punti (a pari merito secondo le fonti disponibili).'
      );
    }
    let out =
      'In classifica di Serie A, al momento è prima ' +
      top.team +
      ' con ' +
      top.pts +
      ' punti';
    if (ranked[1]) {
      out +=
        ', seguita da ' +
        ranked[1].team +
        ' (' +
        ranked[1].pts +
        ' punti)';
      if (ranked[2]) out += ' e ' + ranked[2].team + ' (' + ranked[2].pts + ' punti)';
    }
    out += ', secondo le fonti più recenti trovate.';
    return out;
  }

  // Capolista senza punti
  const cap = t.match(/(?:capolista|in testa|leader)\s*[:=]?\s*([A-ZÀ-Ú][a-zà-ú]+)/i);
  if (cap) {
    return 'In Serie A, al momento risulta in testa ' + cap[1] + ', secondo le fonti disponibili.';
  }

  return null;
}

function extractive(query, cited) {
  if (!cited || !cited.length) return '';
  const qTokens = tokenize(query);
  const scored = [];
  for (const c of cited) {
    const sentences = String(c.text || '')
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.length > 25);
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
    if (picked.length >= 3) break;
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

/** Pulisce e impone lingua */
export function polish(text, lang) {
  let t = String(text || '').trim();

  // Fix duplicati tipo "Roma Roma"
  t = t.replace(/\b([A-ZÀ-Ú][a-zà-ú]{2,})\s+\1\b/g, '$1');

  // Rimuovi meta inglese tipico dei modelli
  t = t.replace(/The sources do not provide[^.]*\./gi, '');
  t = t.replace(/According to the sources[,:]?/gi, '');
  t = t.replace(/as of today's date[,:]?/gi, '');
  t = t.replace(/\b(partial standings|overall winner|definitive answer)\b/gi, '');
  t = t.replace(/\b(extractive|grounded|RAG|pipeline|provider)\b/gi, '');

  if (lang === 'it') {
    // Se il testo è principalmente inglese, prova a non lasciarlo grezzo
    const enMarkers = (t.match(/\b(the|and|with|from|points|followed|according|sources|does not)\b/gi) || [])
      .length;
    const itMarkers = (t.match(/\b(il|la|di|con|punti|seguita|secondo|classifica|prima)\b/gi) || [])
      .length;
    if (enMarkers > itMarkers + 2) {
      // Riscrivi minimo pattern standings già gestiti; altrimenti avviso in IT
      const stand = extractStandingsFromText(t);
      if (stand) return stand;
      t =
        'Dalle fonti disponibili non risulta una risposta chiara e aggiornata in italiano. Ti consiglio di controllare una classifica live (Sky Sport, Lega Serie A o Google).';
    }
  }

  t = t.replace(/\s{2,}/g, ' ').replace(/\n{2,}/g, '\n').trim();
  return t.slice(0, 1200);
}

export function expandForIntent(q, lang) {
  const base = String(q || '').trim();
  const out = [];
  if (/classifica|primo|capolista|in testa/i.test(base)) {
    if (/serie\s*a/i.test(base) || /calcio/i.test(base)) {
      out.push('classifica Serie A aggiornata oggi');
      out.push('Serie A classifica live capolista');
      out.push('Serie A standings today');
    } else {
      out.push(base + ' aggiornata oggi');
      out.push(base + ' live');
    }
  }
  return out;
}
