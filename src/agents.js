/**
 * WidowBlue – catalogo agenti (453)
 * 12 leader di ruolo + 441 worker distribuiti su 3 shell
 * Allineato alla rete neurale del canvas HUD
 */

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
export const WORKER_COUNT = TOTAL_AGENTS - LEADER_COUNT; // 441

/** Distribuzione shell worker: ~25% / 35% / 40% */
export const SHELL_SHARES = [0.25, 0.35, 0.4];

const SPECIALTIES = {
  Coordinatore: ['planning', 'routing', 'priority', 'synthesis'],
  Frontend: ['ui', 'react', 'css', 'a11y', 'animation'],
  Backend: ['api', 'auth', 'workers', 'queue', 'cache'],
  Design: ['layout', 'tokens', 'hud', 'typography', 'motion'],
  Database: ['schema', 'd1', 'kv', 'index', 'backup'],
  Media: ['image', 'video', 'audio', 'ocr'],
  Voce: ['stt', 'tts', 'multilang'],
  Test: ['unit', 'e2e', 'lint', 'security-scan'],
  Memoria: ['context', 'rag', 'history', 'embeddings'],
  Deploy: ['cloudflare', 'ci', 'dns', 'rollback'],
  Sicurezza: ['nis2', 'auth', 'rate-limit', 'spider', 'e2e-crypto'],
  Documenti: ['pdf', 'docx', 'xlsx', 'markdown'],
};

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

/** Genera i 453 agenti in memoria (deterministico) */
export function buildAgentCatalog() {
  const agents = [];
  const now = 0;

  AGENT_ROLES.forEach((role, i) => {
    agents.push({
      id: i + 1,
      slug: `leader-${role.toLowerCase()}`,
      name: role,
      role,
      shell: 0,
      specialty: (SPECIALTIES[role] || ['general'])[0],
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
      const specs = SPECIALTIES[role] || ['general'];
      const spec = specs[k % specs.length];
      const n = workerIdx + 1;
      agents.push({
        id,
        slug: `w${String(n).padStart(3, '0')}-${role.toLowerCase()}-${spec}`,
        name: `${role} · ${spec} #${n}`,
        role,
        shell: shellIdx + 1,
        specialty: spec,
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
  for (const a of all) {
    byRole[a.role] = (byRole[a.role] || 0) + 1;
    byShell[a.shell] = (byShell[a.shell] || 0) + 1;
  }
  return {
    total: all.length,
    leaders: LEADER_COUNT,
    workers: WORKER_COUNT,
    byRole,
    byShell,
  };
}

/** Seleziona agenti attivi per una richiesta (allMode = tutti i leader + sample worker) */
export function selectAgentsForTask(opts = {}) {
  const all = getAgentCatalog();
  const allMode = !!opts.allMode;
  const leaders = all.filter((a) => a.shell === 0);
  if (allMode) {
    // tutti i 12 leader + fino a 48 worker rappresentativi
    const workers = all.filter((a) => a.shell > 0).slice(0, 48);
    return [...leaders, ...workers];
  }
  // routing leggero: coordinatore + 3 ruoli correlati
  const q = String(opts.query || '').toLowerCase();
  const picked = new Set(['Coordinatore']);
  if (/ui|css|react|pagina|design|layout/.test(q)) {
    picked.add('Frontend');
    picked.add('Design');
  }
  if (/api|server|backend|auth|worker/.test(q)) picked.add('Backend');
  if (/db|database|sql|d1|schema/.test(q)) picked.add('Database');
  if (/deploy|cloudflare|dns|ci/.test(q)) picked.add('Deploy');
  if (/sicur|hack|nis2|password|auth/.test(q)) picked.add('Sicurezza');
  if (/voce|audio|speech|tts|stt/.test(q)) picked.add('Voce');
  if (/img|immagine|video|media/.test(q)) picked.add('Media');
  if (/pdf|word|excel|doc/.test(q)) picked.add('Documenti');
  if (/test|bug|qa/.test(q)) picked.add('Test');
  if (/ricorda|contesto|memoria|rag/.test(q)) picked.add('Memoria');
  // default: ricerca / risposta → Memoria + Backend
  if (picked.size < 3) {
    picked.add('Memoria');
    picked.add('Backend');
  }
  return leaders.filter((a) => picked.has(a.role));
}

/** SQL seed per tabella agents (batch) */
export function agentsSeedSQL() {
  const agents = getAgentCatalog();
  const now = Date.now();
  const lines = agents.map((a) => {
    const name = a.name.replace(/'/g, "''");
    const slug = a.slug.replace(/'/g, "''");
    const role = a.role.replace(/'/g, "''");
    const spec = (a.specialty || '').replace(/'/g, "''");
    return `INSERT OR REPLACE INTO agents (id, slug, name, role, shell, specialty, status, priority, enabled, created_at, updated_at) VALUES (${a.id}, '${slug}', '${name}', '${role}', ${a.shell}, '${spec}', 'idle', ${a.priority}, 1, ${now}, ${now});`;
  });
  return lines.join('\n');
}
