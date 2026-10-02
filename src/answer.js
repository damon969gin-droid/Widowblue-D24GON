import { noAnswerMsg, detectLang } from './lang.js';
/**
 * WidowBlue – motore di risposta chat
 * Naturale, filtrato, appropriato, approfondito.
 * Chain-of-thought solo interno (non mostrato all'utente).
 */

const TEAMS_IT = [
  'Napoli','Inter','Milan','Juventus','Roma','Lazio','Atalanta','Fiorentina',
  'Bologna','Torino','Genoa','Como','Udinese','Cagliari','Parma','Lecce',
  'Empoli','Venezia','Monza','Verona','Sassuolo','Cremonese','Pisa','Spezia',
];

const AI_GLOSSARY = {
  addestramento: {
    it: 'L\'addestramento (training) è il processo in cui un modello di machine learning regola i propri parametri sui dati, minimizzando un errore. Include di solito pre-training su grandi corpus e, se serve, fine-tuning su compiti specifici.',
    en: 'Training is the process of adjusting model parameters on data to minimize error, often via pre-training then fine-tuning.',
  },
  agi: {
    it: 'AGI (Artificial General Intelligence) indica un\'intelligenza artificiale con capacità generali paragonabili a quelle umane su molti compiti cognitivi, non limitata a un solo dominio come la maggior parte dei sistemi attuali (AI ristretta).',
    en: 'AGI means AI with broad, human-level cognitive abilities across many domains, unlike today\'s narrow systems.',
  },
  'agente ai': {
    it: 'Un agente AI è un sistema che percepisce un obiettivo, pianifica passi, usa strumenti (ricerca, codice, API) e agisce in autonomia fino a completare il compito, spesso in più turni.',
    en: 'An AI agent pursues a goal, plans steps, uses tools, and acts over multiple turns.',
  },
  'ai generativa': {
    it: 'L\'AI generativa crea nuovi contenuti (testo, immagini, audio, codice) a partire da pattern appresi, invece di limitarsi a classificare o prevedere etichette su dati esistenti.',
    en: 'Generative AI creates new content from learned patterns rather than only classifying existing data.',
  },
  allucinazione: {
    it: 'Un\'allucinazione è quando un modello produce informazioni plausible ma false o non supportate dalle fonti. Si riduce con grounding (RAG), citazioni e verifica fattuale.',
    en: 'Hallucination is plausible but false output; reduced via grounding, citations, and fact checks.',
  },
  bias: {
    it: 'Il bias è una distorsione sistematica nelle predizioni o nei dati (campionamento, etichette, rappresentazione). Può portare a risultati iniqui o poco generalizzabili; si mitiga con dati equilibrati, audit e metriche di fairness.',
    en: 'Bias is systematic distortion in data or predictions; mitigated with balanced data and fairness audits.',
  },
  'chain of thought': {
    it: 'La chain of thought (catena del pensiero) è una tecnica in cui il modello ragiona per passi intermedi prima della risposta finale, migliorando compiti multi-step. In produzione i passi possono restare interni e mostrare solo la conclusione.',
    en: 'Chain of thought is step-by-step intermediate reasoning before the final answer.',
  },
  'catena del pensiero': {
    it: 'La chain of thought (catena del pensiero) è una tecnica in cui il modello ragiona per passi intermedi prima della risposta finale, migliorando compiti multi-step. In produzione i passi possono restare interni e mostrare solo la conclusione.',
    en: 'Chain of thought is step-by-step intermediate reasoning before the final answer.',
  },
  dataset: {
    it: 'Un dataset è l\'insieme di esempi (testo, immagini, tabelle) usato per addestrare, validare o testare un modello. Qualità, copertura e bilanciamento del dataset influenzano direttamente le prestazioni.',
    en: 'A dataset is the collection of examples used to train, validate, or test a model.',
  },
  'deep learning': {
    it: 'Il deep learning usa reti neurali con molti strati per apprendere rappresentazioni gerarchiche dai dati. È alla base di vision, NLP e modelli generativi moderni.',
    en: 'Deep learning uses multi-layer neural nets to learn hierarchical representations.',
  },
  distillazione: {
    it: 'La distillazione (knowledge distillation) trasferisce conoscenza da un modello grande (teacher) a uno più piccolo (student), mantenendo buona qualità con costi di inferenza inferiori.',
    en: 'Distillation transfers knowledge from a large teacher model to a smaller student.',
  },
  'fine-tuning': {
    it: 'Il fine-tuning adatta un modello già pre-addestrato a un compito o dominio specifico, aggiornando (tutti o parte dei) parametri su un dataset più mirato. Tecniche come LoRA riducono il costo.',
    en: 'Fine-tuning adapts a pretrained model to a specific task, sometimes via LoRA adapters.',
  },
  llm: {
    it: 'Un LLM (Large Language Model) è un modello linguistico di grandi dimensioni, tipicamente basato su Transformer, addestrato su enormi quantità di testo per predire e generare linguaggio.',
    en: 'An LLM is a large Transformer-based language model trained to predict and generate text.',
  },
  'machine learning': {
    it: 'Il machine learning è l\'insieme di metodi che permettono a un sistema di migliorare le prestazioni su un compito a partire dai dati, senza regole scritte a mano per ogni caso.',
    en: 'Machine learning improves task performance from data without hand-coded rules for every case.',
  },
  'pre-training': {
    it: 'Il pre-training è la fase iniziale di apprendimento su grandi dataset generici (es. testo web), che dà al modello conoscenze linguistiche e di mondo prima del fine-tuning.',
    en: 'Pre-training is large-scale generic learning before task-specific fine-tuning.',
  },
  'prompt engineering': {
    it: 'Il prompt engineering progetta istruzioni e contesti per ottenere dal modello risposte più accurate, stabili e utili, senza riallenare i pesi.',
    en: 'Prompt engineering crafts instructions to steer model output without retraining weights.',
  },
  'rete neurale': {
    it: 'Una rete neurale è un modello composito di unità (neuroni) collegate da pesi: trasforma input in output attraverso strati e non-linearità, addestrata tipicamente con backpropagation.',
    en: 'A neural network maps inputs to outputs via weighted layers trained with backpropagation.',
  },
  'superintelligenza artificiale': {
    it: 'La superintelligenza artificiale (ASI) descrive un\'ipotetica AI che supera di molto le capacità cognitive umane nella maggior parte dei domini. È un concetto teorico/futuribile, distinto dall\'AGI e dai sistemi attuali.',
    en: 'ASI is hypothetical AI far beyond human cognitive ability across most domains.',
  },
  token: {
    it: 'Un token è l\'unità base con cui i modelli linguistici spezzano il testo (parole, sottoparole o caratteri). Il numero di token influenza contesto massimo e costo di elaborazione.',
    en: 'A token is the basic text unit models process; count affects context window and cost.',
  },
};

const GLOSSARY_ALIASES = [
  ['addestramento', /\b(addestramento|training)\b/i],
  ['agi', /\bagi\b|intelligenza generale|artificial general/i],
  ['agente ai', /\bagente\s*ai\b|\bai\s*agent\b/i],
  ['ai generativa', /ai\s*generativa|generative\s*ai/i],
  ['allucinazione', /allucinazion|hallucin/i],
  ['bias', /\bbias\b|distorsion/i],
  ['chain of thought', /chain\s*of\s*thought|catena del pensier/i],
  ['dataset', /\bdataset\b|insieme di dati/i],
  ['deep learning', /deep\s*learning|apprendimento profondo/i],
  ['distillazione', /distillazion|knowledge\s*distillation/i],
  ['fine-tuning', /fine[\s-]?tuning|\blora\b/i],
  ['llm', /\bllm\b|large language model|modello linguistico/i],
  ['machine learning', /machine\s*learning|apprendimento automatico/i],
  ['pre-training', /pre[\s-]?training|preaddestr/i],
  ['prompt engineering', /prompt\s*engineering|ingegneria del prompt/i],
  ['rete neurale', /rete\s*neural|neural\s*network/i],
  ['superintelligenza artificiale', /superintelligen|\basi\b|artificial superintelligence/i],
  ['token', /\btoken\b|tokenizzaz/i],
];

function glossaryAnswer(query, lang) {
  const ql = String(query || '');
  const code = String(lang || 'it').slice(0, 2);
  for (const [key, re] of GLOSSARY_ALIASES) {
    if (re.test(ql) && AI_GLOSSARY[key]) {
      return AI_GLOSSARY[key][code] || AI_GLOSSARY[key].it;
    }
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
    if (fromSources && fromSources.length > 40) {
      return polish(mergeDeep(gloss, fromSources, langCode), langCode);
    }
    return polish(gloss, langCode);
  }

  if (priorAnswer && priorAnswer.text && priorAnswer.text.length > 30) {
    let t = priorAnswer.text;
    if (/classifica|primo|serie a/i.test(ql)) {
      const stand = extractStandingsFromText(t);
      if (stand) return polish(stand, langCode);
    }
    const deepened = deepenFromSources(query, t, cited, langCode);
    return polish(deepened, langCode);
  }

  const ext = extractive(query, cited);
  if (ext) return polish(deepenFromSources(query, ext, cited, langCode), langCode);

  return noAnswerMsg(langCode);
}

function mergeDeep(core, extra, lang) {
  const e = String(extra || '').trim();
  if (!e) return core;
  if (lang === 'en') return core + ' ' + e.slice(0, 500);
  return core + ' In sintesi dalle fonti: ' + e.slice(0, 500);
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
  while ((m = reEn.exec(t))) {
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
      return 'In classifica di Serie A, al momento in testa ci sono ' + same.join(', ') + ' a ' + top.pts + ' punti (a pari merito secondo le fonti disponibili).';
    }
    let out = 'In classifica di Serie A, al momento è prima ' + top.team + ' con ' + top.pts + ' punti';
    if (ranked[1]) {
      out += ', seguita da ' + ranked[1].team + ' (' + ranked[1].pts + ' punti)';
      if (ranked[2]) out += ' e ' + ranked[2].team + ' (' + ranked[2].pts + ' punti)';
    }
    out += ', secondo le fonti più recenti trovate.';
    return out;
  }
  const cap = t.match(/(?:capolista|in testa|leader)\s*[:=]?\s*([A-ZÀ-Ú][a-zà-ú]+)/i);
  if (cap) return 'In Serie A, al momento risulta in testa ' + cap[1] + ', secondo le fonti disponibili.';
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
  t = t.replace(/\b([A-ZÀ-Ú][a-zà-ú]{2,})\s+\1\b/g, '$1');
  t = t.replace(/The sources do not provide[^.]*\./gi, '');
  t = t.replace(/According to the sources[,:]?/gi, '');
  t = t.replace(/as of today's date[,:]?/gi, '');
  t = t.replace(/\b(partial standings|overall winner|definitive answer)\b/gi, '');
  t = t.replace(/\b(extractive|grounded|RAG|pipeline|provider|Workers AI|system prompt)\b/gi, '');
  t = t.replace(/\b(Step\s*\d+|Chain of thought:|Internal reasoning:)\b/gi, '');
  t = t.replace(/\b(how to (make|build) (a )?bomb|child sexual)\b/gi, '[contenuto rimosso]');

  if (lang && lang !== 'en') {
    const enMarkers = (t.match(/\b(the|and|with|from|points|followed|according|sources|does not|provide)\b/gi) || []).length;
    const localHints = (t.match(/[àèéìòùäöüßñ¿¡\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af\u0400-\u04ff]/g) || []).length;
    if (enMarkers > 4 && localHints < 2) {
      const stand = extractStandingsFromText(t);
      if (stand && lang === 'it') return stand;
      const gloss = glossaryAnswer(t, lang);
      if (gloss) return gloss;
    }
  }

  t = t.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t.slice(0, 2200);
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
  if (/\b(llm|transformer|rag|fine-tuning|allucinaz)/i.test(base)) {
    out.push(base + ' spiegazione');
    out.push(base + ' definition explained');
  }
  return out;
}
