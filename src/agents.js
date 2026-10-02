/**
 * WidowBlue – catalogo 453 agenti specializzati
 * Ogni agente ha ruolo + specialità + dominio di compito distinto:
 * ricerca, immagini, contenuti, programmazione, matematica, analisi, ML
 * + mappa curriculum AI (7 parti) per routing intelligente
 */

import { CURRICULUM_SPECS, matchCurriculum, curriculumDomains, curriculumSummary } from './curriculum.js';

export const AGENT_ROLES = [
  'Coordinatore',
  'Frontend',
  'Backend',
  'Design',
  'Database',
  'Media',
  'Voce',
  'Test',
  'Memoria',
  'Deploy',
  'Sicurezza',
  'Documenti',
];

export const TOTAL_AGENTS = 453;
export const LEADER_COUNT = 12;
export const WORKER_COUNT = TOTAL_AGENTS - LEADER_COUNT;
export const SHELL_SHARES = [0.25, 0.35, 0.4];

export const DOMAINS = {
  search: 'ricerca',
  image: 'immagini',
  content: 'contenuti',
  code: 'programmazione',
  math: 'matematica',
  analysis: 'analisi',
  ml: 'machine-learning',
  security: 'sicurezza',
  voice: 'voce',
  deploy: 'deploy',
};

const SPECIALTIES = {
  Coordinatore: [
    { s: 'intent-routing', domain: 'search', task: 'Classifica intent e assegna agenti' },
    { s: 'plan-synthesis', domain: 'analysis', task: 'Sintetizza il piano multi-agente' },
    { s: 'priority-queue', domain: 'analysis', task: 'Ordina priorità dei task' },
    { s: 'conflict-resolve', domain: 'analysis', task: 'Risolve conflitti tra risposte agenti' },
    { s: 'quality-gate', domain: 'analysis', task: 'Verifica qualità risposta finale' },
  ],
  Frontend: [
    { s: 'react-ui', domain: 'code', task: 'Scrive componenti React/UI' },
    { s: 'css-layout', domain: 'code', task: 'Layout CSS/Tailwind responsivi' },
    { s: 'a11y', domain: 'code', task: 'Accessibilità e ARIA' },
    { s: 'animation', domain: 'code', task: 'Animazioni e micro-interazioni' },
    { s: 'hud-canvas', domain: 'code', task: 'Canvas HUD e visualizzazioni' },
  ],
  Backend: [
    { s: 'api-design', domain: 'code', task: 'Progetta endpoint API' },
    { s: 'auth-flow', domain: 'security', task: 'Flussi autenticazione e sessioni' },
    { s: 'workers-edge', domain: 'code', task: 'Cloudflare Workers / edge logic' },
    { s: 'queue-jobs', domain: 'code', task: 'Code e job asincroni' },
    { s: 'cache-layer', domain: 'code', task: 'Strategia cache e invalidazione' },
  ],
  Design: [
    { s: 'visual-system', domain: 'content', task: 'Sistema visuale e token design' },
    { s: 'copy-ux', domain: 'content', task: 'Microcopy e UX writing' },
    { s: 'layout-ia', domain: 'content', task: 'Information architecture' },
    { s: 'brand-hud', domain: 'content', task: 'Identità HUD cyberpunk' },
    { s: 'motion-design', domain: 'content', task: 'Motion design e timing' },
  ],
  Database: [
    { s: 'schema-sql', domain: 'code', task: 'Schema SQL e migrazioni' },
    { s: 'd1-query', domain: 'code', task: 'Query D1 ottimizzate' },
    { s: 'kv-store', domain: 'code', task: 'Pattern KV e TTL' },
    { s: 'index-plan', domain: 'analysis', task: 'Piani di indicizzazione' },
    { s: 'backup-321', domain: 'security', task: 'Backup regola 3-2-1' },
  ],
  Media: [
    { s: 'image-gen', domain: 'image', task: 'Generazione immagini da prompt' },
    { s: 'image-edit', domain: 'image', task: 'Editing e composizione immagini' },
    { s: 'vision-ocr', domain: 'image', task: 'OCR e comprensione visiva' },
    { s: 'video-frame', domain: 'image', task: 'Analisi frame video' },
    { s: 'asset-pack', domain: 'content', task: 'Packaging asset media' },
  ],
  Voce: [
    { s: 'stt-multilang', domain: 'voice', task: 'Speech-to-text multilingua' },
    { s: 'tts-natural', domain: 'voice', task: 'Text-to-speech naturale' },
    { s: 'voice-intent', domain: 'voice', task: 'Intent da audio' },
    { s: 'diarization', domain: 'voice', task: 'Diarizzazione parlanti' },
  ],
  Test: [
    { s: 'unit-test', domain: 'code', task: 'Test unitari' },
    { s: 'e2e-flow', domain: 'code', task: 'Test end-to-end' },
    { s: 'lint-static', domain: 'code', task: 'Analisi statica e lint' },
    { s: 'fuzz-edge', domain: 'security', task: 'Fuzzing input edge-case' },
    { s: 'regression', domain: 'analysis', task: 'Regressioni e golden tests' },
  ],
  Memoria: [
    { s: 'web-retrieve', domain: 'search', task: 'Retrieval web multi-provider' },
    { s: 'rag-chunk', domain: 'search', task: 'Chunking e ranking RAG' },
    { s: 'context-track', domain: 'search', task: 'Tracking contesto conversazione' },
    { s: 'embed-sim', domain: 'ml', task: 'Similarità embedding' },
    { s: 'fact-ground', domain: 'search', task: 'Grounding fatti sulle fonti' },
  ],
  Deploy: [
    { s: 'cf-pages', domain: 'deploy', task: 'Deploy Cloudflare Pages/Workers' },
    { s: 'ci-pipeline', domain: 'deploy', task: 'Pipeline CI/CD' },
    { s: 'dns-tls', domain: 'deploy', task: 'DNS e TLS' },
    { s: 'rollback', domain: 'deploy', task: 'Rollback e versioning' },
  ],
  Sicurezza: [
    { s: 'nis2-control', domain: 'security', task: 'Controlli NIS2' },
    { s: 'threat-model', domain: 'security', task: 'Threat modeling' },
    { s: 'spider-alert', domain: 'security', task: 'Spider control e alert' },
    { s: 'crypto-e2e', domain: 'security', task: 'Crittografia e-to-e' },
    { s: 'rate-limit', domain: 'security', task: 'Rate limit e anti-abuso' },
  ],
  Documenti: [
    { s: 'pdf-extract', domain: 'content', task: 'Estrazione PDF' },
    { s: 'docx-parse', domain: 'content', task: 'Parsing Word' },
    { s: 'xlsx-data', domain: 'content', task: 'Analisi Excel/CSV' },
    { s: 'md-docs', domain: 'content', task: 'Documentazione Markdown' },
    { s: 'content-gen', domain: 'content', task: 'Generazione testi e articoli' },
  ],
};

const EXTRA_SPECS = [
  { s: 'algebra', domain: 'math', task: 'Risolve equazioni e algebra' },
  { s: 'calculus', domain: 'math', task: 'Derivate, integrali, limiti' },
  { s: 'stats', domain: 'math', task: 'Statistica e probabilità' },
  { s: 'geometry', domain: 'math', task: 'Geometria e trigonometria' },
  { s: 'numeric', domain: 'math', task: 'Metodi numerici' },
  { s: 'logic-proof', domain: 'math', task: 'Logica e dimostrazioni' },
  { s: 'data-analysis', domain: 'analysis', task: 'Analisi dati e pattern' },
  { s: 'causal', domain: 'analysis', task: 'Ragionamento causale' },
  { s: 'compare', domain: 'analysis', task: 'Confronto opzioni e trade-off' },
  { s: 'critique', domain: 'analysis', task: 'Critica fonti e bias' },
  { s: 'forecast', domain: 'analysis', task: 'Stime e proiezioni' },
  { s: 'classify', domain: 'ml', task: 'Classificazione intent/testo' },
  { s: 'cluster', domain: 'ml', task: 'Clustering risultati' },
  { s: 'rank-learn', domain: 'ml', task: 'Learning-to-rank fonti' },
  { s: 'ner-extract', domain: 'ml', task: 'Named entity recognition' },
  { s: 'summarize-ml', domain: 'ml', task: 'Summarization astrattiva' },
  { s: 'prompt-opt', domain: 'ml', task: 'Ottimizzazione prompt' },
  { s: 'code-gen', domain: 'code', task: 'Generazione codice multi-linguaggio' },
  { s: 'code-review', domain: 'code', task: 'Review e refactor' },
  { s: 'algo-design', domain: 'code', task: 'Design algoritmi' },
  { s: 'deep-search', domain: 'search', task: 'Deep search multi-hop' },
  { s: 'query-expand', domain: 'search', task: 'Espansione query' },
  { s: 'source-verify', domain: 'search', task: 'Verifica affidabilità fonti' },
  { s: 'img-prompt', domain: 'image', task: 'Prompt engineering immagini' },
  { s: 'style-transfer', domain: 'image', task: 'Stile e coerenza visuale' },
  ...CURRICULUM_SPECS.map(({ s, domain, task }) => ({ s, domain, task })),
];

function shellCounts(totalWorkers) {
  const raw = SHELL_SHARES.map((s) => Math.floor(totalWorkers * s));
  let sum = raw.reduce((a, b) => a + b, 0);
  let i = 0;
  while (sum < totalWorkers) {
    raw[i % raw.length]++;
    sum++;
    i++;
  }
  return raw;
}

function pickSpec(role, k) {
  const list = SPECIALTIES[role] || [{ s: 'general', domain: 'analysis', task: 'Supporto generico' }];
  if (k % 4 === 3) {
    return EXTRA_SPECS[k % EXTRA_SPECS.length];
  }
  if (k % 7 === 0 && CURRICULUM_SPECS.length) {
    const c = CURRICULUM_SPECS[k % CURRICULUM_SPECS.length];
    return { s: c.s, domain: c.domain, task: c.task };
  }
  return list[k % list.length];
}

export function buildAgentCatalog() {
  const agents = [];
  AGENT_ROLES.forEach((role, i) => {
    const spec = (SPECIALTIES[role] || [{ s: 'lead', domain: 'analysis', task: 'Leadership ' + role }])[0];
    agents.push({
      id: i + 1,
      slug: `leader-${role.toLowerCase()}`,
      name: role,
      role,
      shell: 0,
      specialty: spec.s,
      domain: spec.domain,
      task: spec.task,
      status: 'idle',
      priority: 100 - i,
      enabled: 1,
      leader: true,
    });
  });

  const counts = shellCounts(WORKER_COUNT);
  let id = LEADER_COUNT + 1;
  let workerIdx = 0;
  counts.forEach((count, shellIdx) => {
    for (let k = 0; k < count; k++) {
      const role = AGENT_ROLES[workerIdx % AGENT_ROLES.length];
      const spec = pickSpec(role, workerIdx);
      const n = workerIdx + 1;
      agents.push({
        id,
        slug: `w${String(n).padStart(3, '0')}-${spec.domain}-${spec.s}`,
        name: `${role} · ${spec.s}`,
        role,
        shell: shellIdx + 1,
        specialty: spec.s,
        domain: spec.domain,
        task: spec.task,
        status: 'idle',
        priority: 40 + (shellIdx === 0 ? 20 : shellIdx === 1 ? 10 : 0),
        enabled: 1,
        leader: false,
      });
      id++;
      workerIdx++;
    }
  });
  return agents;
}

let _cache = null;
export function getAgentCatalog() {
  if (!_cache) _cache = buildAgentCatalog();
  return _cache;
}

export function agentStats() {
  const all = getAgentCatalog();
  const byRole = {};
  const byShell = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const byDomain = {};
  for (const a of all) {
    byRole[a.role] = (byRole[a.role] || 0) + 1;
    byShell[a.shell] = (byShell[a.shell] || 0) + 1;
    byDomain[a.domain || 'other'] = (byDomain[a.domain || 'other'] || 0) + 1;
  }
  return {
    total: all.length,
    leaders: LEADER_COUNT,
    workers: WORKER_COUNT,
    byRole,
    byShell,
    byDomain,
    curriculumParts: 7,
    curriculum: curriculumSummary(),
  };
}

export function detectIntent(query) {
  const q = String(query || '').toLowerCase();
  if (/genera\s+(un['\u2019]?\s*)?(immagine|img|foto|disegno)|create\s+(an?\s+)?image|draw\s+/i.test(q))
    return 'image';
  if (/\b(codice|programma|script|function|class|api|react|python|typescript|bug|refactor)\b/i.test(q))
    return 'code';
  if (/\b(equazion|integral|derivat|calcol[oa]|matematic|algebra|geometr|probabilit|statist)\b/i.test(q) ||
      /[∫∑√π]|\d+\s*[\+\-\*\/\^]\s*\d+/.test(q))
    return 'math';
  if (/\b(machine learning|modello|neural|classific|embedding|train|dataset|ml\b|transformer|llm|rag\b|backprop|overfitting|cnn|ocr|ner\b|fine-?tuning|iperparametr|allucinazion|agentic|orchestrazion)\b/i.test(q))
    return 'ml';
  if (/\b(analizza|confronta|perché|perche|valuta|critica|trade-?off|pro\s*e\s*contro)\b/i.test(q))
    return 'analysis';
  if (/\b(scrivi|articolo|post|testo|contenuto|documenta|riassunto|email)\b/i.test(q))
    return 'content';
  if (/\b(sicur|hack|nis2|vulnerab|password|auth)\b/i.test(q))
    return 'security';
  return 'search';
}

const INTENT_DOMAINS = {
  search: ['search', 'analysis', 'ml'],
  image: ['image', 'content', 'ml'],
  code: ['code', 'analysis', 'test'],
  math: ['math', 'analysis', 'ml'],
  ml: ['ml', 'math', 'analysis', 'code'],
  analysis: ['analysis', 'search', 'ml'],
  content: ['content', 'search', 'analysis'],
  security: ['security', 'code', 'analysis'],
};

export function selectAgentsForTask(opts = {}) {
  const all = getAgentCatalog();
  const q = String(opts.query || '');
  const intent = opts.intent || detectIntent(q);
  const allMode = !!opts.allMode;
  let domains = (INTENT_DOMAINS[intent] || INTENT_DOMAINS.search).slice();
  const curHits = matchCurriculum(q);
  const curDom = curriculumDomains(q);
  for (const d of curDom) {
    if (!domains.includes(d)) domains.push(d);
  }

  const leaders = all.filter((a) => a.shell === 0);
  const coordinator = leaders.find((a) => a.role === 'Coordinatore');
  const memoria = leaders.find((a) => a.role === 'Memoria');

  const team = [];
  const seen = new Set();
  function add(a) {
    if (!a || seen.has(a.id)) return;
    seen.add(a.id);
    team.push({
      id: a.id,
      name: a.name,
      role: a.role,
      specialty: a.specialty,
      domain: a.domain,
      task: a.task,
      shell: a.shell,
      leader: !!a.leader,
    });
  }

  add(coordinator);
  add(memoria);

  for (const d of domains) {
    const lead =
      leaders.find((a) => a.domain === d) ||
      leaders.find((a) => (SPECIALTIES[a.role] || []).some((x) => x.domain === d));
    if (lead) add(lead);
  }

  const maxWorkers = allMode ? 36 : intent === 'search' ? 8 : 12;
  for (const d of domains) {
    const pool = all.filter((a) => a.shell > 0 && a.domain === d);
    const take = Math.max(2, Math.floor(maxWorkers / domains.length));
    for (const a of pool.slice(0, take)) add(a);
  }

  if (intent === 'code') {
    leaders.filter((a) => ['Frontend', 'Backend', 'Test', 'Database'].includes(a.role)).forEach(add);
  }
  if (intent === 'image') {
    leaders.filter((a) => ['Media', 'Design'].includes(a.role)).forEach(add);
  }
  if (intent === 'math' || intent === 'ml') {
    all
      .filter((a) => a.shell > 0 && (a.domain === 'math' || a.domain === 'ml'))
      .slice(0, allMode ? 20 : 6)
      .forEach(add);
  }
  if (intent === 'security') {
    leaders.filter((a) => a.role === 'Sicurezza').forEach(add);
  }

  if (allMode) {
    leaders.forEach(add);
    all.filter((a) => a.shell > 0).slice(0, 48).forEach(add);
  }

  return {
    intent,
    domains,
    agents: team,
    count: team.length,
    curriculum: curHits && curHits.length ? curHits : undefined,
  };
}

export function runAgentContributions(query, selection, extras = {}) {
  const q = String(query || '').trim();
  const agents = (selection && selection.agents) || [];
  const intent = (selection && selection.intent) || detectIntent(q);
  const contributions = agents.map((a) => {
    let note = a.task || a.specialty;
    if (a.domain === 'search') note = `Ricerca: ${a.task} su «${q.slice(0, 80)}»`;
    if (a.domain === 'image') note = `Immagini: ${a.task}`;
    if (a.domain === 'code') note = `Codice: ${a.task}`;
    if (a.domain === 'math') note = `Matematica: ${a.task}`;
    if (a.domain === 'ml') note = `ML: ${a.task}`;
    if (a.domain === 'analysis') note = `Analisi: ${a.task}`;
    if (a.domain === 'content') note = `Contenuti: ${a.task}`;
    if (a.domain === 'security') note = `Sicurezza: ${a.task}`;
    return {
      agentId: a.id,
      name: a.name,
      role: a.role,
      domain: a.domain,
      specialty: a.specialty,
      task: a.task,
      status: 'done',
      note,
    };
  });

  return {
    intent,
    query: q,
    agentCount: contributions.length,
    domains: selection.domains || [],
    curriculum: selection.curriculum,
    contributions,
    boosts: {
      preferDeep: intent === 'search' || intent === 'analysis' || intent === 'ml',
      preferImage: intent === 'image',
      preferCodeStructure: intent === 'code',
      preferMathSteps: intent === 'math',
      preferMlFraming: intent === 'ml',
    },
  };
}

export function agentsSeedSQL() {
  const agents = getAgentCatalog();
  const now = Date.now();
  return agents
    .map((a) => {
      const name = a.name.replace(/'/g, "''");
      const slug = a.slug.replace(/'/g, "''");
      const role = a.role.replace(/'/g, "''");
      const spec = (a.specialty || '').replace(/'/g, "''");
      return `INSERT OR REPLACE INTO agents (id, slug, name, role, shell, specialty, status, priority, enabled, created_at, updated_at) VALUES (${a.id}, '${slug}', '${name}', '${role}', ${a.shell}, '${spec}', 'idle', ${a.priority}, 1, ${now}, ${now});`;
    })
    .join('\n');
}

export { matchCurriculum, curriculumDomains, curriculumSummary, CURRICULUM_SPECS };
