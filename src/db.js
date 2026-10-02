/**
 * WidowBlue – layer database Cloudflare D1
 * Binding: env.DB
 */

import { getAgentCatalog, agentsSeedSQL, agentStats } from './agents.js';

export function hasDB(env) {
  return !!(env && env.DB);
}

export async function dbHealth(env) {
  if (!hasDB(env)) return { ok: false, configured: false };
  try {
    const r = await env.DB.prepare('SELECT 1 AS ok').first();
    let agentCount = 0;
    try {
      const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM agents').first();
      agentCount = (c && c.n) || 0;
    } catch (_) {
      agentCount = -1; // tabella assente
    }
    return { ok: true, configured: true, ping: r, agentCount };
  } catch (e) {
    return { ok: false, configured: true, error: String(e.message || e) };
  }
}

/** Seed agenti se tabella vuota o incompleta */
export async function ensureAgentsSeeded(env) {
  if (!hasDB(env)) return { seeded: false, reason: 'no_db' };
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM agents').first();
    const n = (row && row.n) || 0;
    if (n >= 453) return { seeded: false, already: n };

    const catalog = getAgentCatalog();
    const now = Date.now();
    // batch da 40 statement
    const stmts = catalog.map((a) =>
      env.DB.prepare(
        `INSERT OR REPLACE INTO agents (id, slug, name, role, shell, specialty, status, priority, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'idle', ?, 1, ?, ?)`
      ).bind(a.id, a.slug, a.name, a.role, a.shell, a.specialty || '', a.priority, now, now)
    );
    for (let i = 0; i < stmts.length; i += 40) {
      await env.DB.batch(stmts.slice(i, i + 40));
    }
    return { seeded: true, count: catalog.length };
  } catch (e) {
    return { seeded: false, error: String(e.message || e) };
  }
}

export async function listAgents(env, { role, shell, limit = 50 } = {}) {
  if (!hasDB(env)) {
    // fallback in-memory
    let all = getAgentCatalog();
    if (role) all = all.filter((a) => a.role === role);
    if (shell != null) all = all.filter((a) => a.shell === Number(shell));
    return { source: 'memory', agents: all.slice(0, limit), stats: agentStats() };
  }
  try {
    let sql = 'SELECT id, slug, name, role, shell, specialty, status, priority, enabled FROM agents WHERE enabled = 1';
    const binds = [];
    if (role) {
      sql += ' AND role = ?';
      binds.push(role);
    }
    if (shell != null && shell !== '') {
      sql += ' AND shell = ?';
      binds.push(Number(shell));
    }
    sql += ' ORDER BY shell ASC, priority DESC, id ASC LIMIT ?';
    binds.push(Math.min(Number(limit) || 50, 453));
    const stmt = env.DB.prepare(sql).bind(...binds);
    const { results } = await stmt.all();
    return { source: 'd1', agents: results || [], stats: agentStats() };
  } catch (e) {
    return { source: 'memory', agents: getAgentCatalog().slice(0, limit), stats: agentStats(), error: String(e.message || e) };
  }
}

export async function saveConversation(env, { id, userId, title, lang }) {
  if (!hasDB(env)) return null;
  const now = Date.now();
  const cid = id || crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO conversations (id, user_id, title, lang, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at, lang = excluded.lang`
  )
    .bind(cid, userId || null, title || 'Chat', lang || 'it', now, now)
    .run();
  return cid;
}

export async function appendMessage(env, { conversationId, role, content, meta }) {
  if (!hasDB(env) || !conversationId) return null;
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, conversationId, role, content || '', meta ? JSON.stringify(meta) : null, now)
    .run();
  await env.DB.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).bind(now, conversationId).run();
  return id;
}

export async function logSearch(env, { conversationId, query, lang, providers, resultCount, ms }) {
  if (!hasDB(env)) return;
  try {
    await env.DB.prepare(
      `INSERT INTO search_logs (id, conversation_id, query, lang, providers_json, result_count, ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        conversationId || null,
        query || '',
        lang || 'it',
        providers ? JSON.stringify(providers) : null,
        resultCount || 0,
        ms || 0,
        Date.now()
      )
      .run();
  } catch (_) {}
}

export async function logSecurity(env, kind, detail, ip, userId) {
  if (!hasDB(env)) return;
  try {
    await env.DB.prepare(
      `INSERT INTO security_events (id, kind, detail, ip, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(crypto.randomUUID(), kind, detail || '', ip || null, userId || null, Date.now())
      .run();
  } catch (_) {}
}
