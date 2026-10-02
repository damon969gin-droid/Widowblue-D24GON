/**
 * WidowBlue Worker – Auth + Search + RAG + Image + Orchestrator + Agents + D1
 * Superadmin: giorgi.daniele96@gmail.com
 */

import { modularSearch } from './search.js';
import { runRAG } from './rag.js';
import { isImageRequest, generateImage } from './image.js';
import { buildConversationContext } from './context.js';
import { agentStats, selectAgentsForTask, runAgentContributions, detectIntent, getAgentCatalog, curriculumSummary, matchCurriculum } from './agents.js';
import { hasDB, dbHealth, listAgents, ensureAgentsSeeded, logSearch } from './db.js';
import { resolveLang, detectLang, translateText } from './lang.js';

const ADMIN_EMAIL = 'giorgi.daniele96@gmail.com';
const SESSION_TTL_SEC = 60 * 60 * 24 * 7;
const MAX_FAIL = 8;
const LOCK_SEC = 15 * 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('WidowBlue Worker up', { status: 200 });
  },
};

async function handleApi(request, env, url) {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    if (url.pathname === '/api/health') {
      const db = await dbHealth(env);
      return json(
        {
          ok: true,
          service: 'widowblue',
          conversation: true,
          contextLearning: true,
          rag: true,
          image: true,
          multiAgent: true,
          curriculum: true,
          multiLang: true,
          workersAI: !!env.AI,
          kv: !!env.AUTH_KV,
          d1: hasDB(env),
          d1Health: db,
          agents: agentStats().total,
          agentDomains: agentStats().byDomain,
          tavily: !!env.TAVILY_API_KEY,
          serper: !!env.SERPER_API_KEY,
          brave: !!env.BRAVE_API_KEY,
          google: !!(env.GOOGLE_API_KEY && env.GOOGLE_CSE_ID),
          bing: !!env.BING_API_KEY,
          perplexity: !!env.PERPLEXITY_API_KEY,
          endpoints: [
            '/api/health',
            '/api/auth/*',
            '/api/search',
            '/api/rag',
            '/api/image',
            '/api/orchestrate',
            '/api/agents',
            '/api/agents/stats',
            '/api/agents/seed',
            '/api/curriculum',
          ],
        },
        200,
        cors
      );
    }

    if (url.pathname === '/api/auth/register' && request.method === 'POST') return register(request, env, cors);
    if (url.pathname === '/api/auth/login' && request.method === 'POST') return login(request, env, cors);
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') return logout(request, env, cors);
    if (url.pathname === '/api/auth/me' && request.method === 'GET') return me(request, env, cors);
    if (url.pathname === '/api/auth/timed-key' && request.method === 'POST') return timedKey(request, env, cors);

    if (url.pathname === '/api/agents' && request.method === 'GET') {
      const role = url.searchParams.get('role') || undefined;
      const shell = url.searchParams.get('shell');
      const domain = url.searchParams.get('domain') || undefined;
      const limit = url.searchParams.get('limit') || '50';
      const data = await listAgents(env, {
        role,
        shell: shell != null && shell !== '' ? shell : undefined,
        limit: Number(limit) || 50,
      });
      if (domain && data.agents) {
        data.agents = data.agents.filter((a) => a.domain === domain || !a.domain);
        if (data.source === 'memory') {
          data.agents = getAgentCatalog()
            .filter((a) => a.domain === domain)
            .slice(0, Number(limit) || 50);
        }
      }
      return json({ ok: true, ...data }, 200, cors);
    }
    if (url.pathname === '/api/agents/stats' && request.method === 'GET') {
      const stats = agentStats();
      const db = await dbHealth(env);
      const sample = selectAgentsForTask({ query: url.searchParams.get('q') || 'ricerca web', allMode: false });
      return json(
        {
          ok: true,
          stats,
          db,
          sampleIntent: sample.intent,
          sampleTeam: sample.agents.slice(0, 12),
          curriculum: sample.curriculum || curriculumSummary(),
        },
        200,
        cors
      );
    }
    if (url.pathname === '/api/agents/seed' && request.method === 'POST') {
      const r = await ensureAgentsSeeded(env);
      return json({ ok: !r.error, ...r }, r.error ? 500 : 200, cors);
    }

    if (url.pathname === '/api/search' && request.method === 'POST') return handleSearch(request, env, cors);
    if (url.pathname === '/api/rag' && request.method === 'POST') return handleRAG(request, env, cors);
    if (url.pathname === '/api/image' && request.method === 'POST') return handleImage(request, env, cors);
    if (url.pathname === '/api/orchestrate' && request.method === 'POST') return handleOrchestrate(request, env, cors);

    if (url.pathname === '/api/curriculum' && request.method === 'GET') {
      const q = url.searchParams.get('q') || '';
      const hits = q ? matchCurriculum(q) : [];
      return json(
        {
          ok: true,
          parts: curriculumSummary(),
          match: hits,
          matched: hits.length > 0,
        },
        200,
        cors
      );
    }

    return json({ error: 'not_found' }, 404, cors);
  } catch (e) {
    return json({ error: 'server_error', message: String(e.message || e) }, 500, cors);
  }
}

/* resolveLang from lang.js */

async function handleSearch(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const raw = String(body.query || body.q || '').trim();
  const deep = !!body.deep;
  const history = body.history || [];
  const useRag = body.rag !== false;
  if (!raw) return json({ error: 'empty_query' }, 400, cors);

  const ctx = buildConversationContext(raw, history);
  const lang = resolveLang(body, raw);
  const detected = detectLang(raw);
  let searchQuery = ctx.query || raw;
  if (body.lang && body.lang !== 'auto' && detected !== lang && searchQuery.length > 2) {
    try {
      const tr = await translateText(searchQuery, detected, lang);
      if (tr && tr.length > 2) searchQuery = tr;
    } catch (_) {}
  }
  await logSpider(env, 'search_query', null, request);

  if (isImageRequest(raw)) {
    const img = await generateImage(raw, { env, lang });
    const selection = selectAgentsForTask({ query: raw, intent: 'image', allMode: !!body.allAgents });
    return json(
      {
        ok: true,
        mode: 'image',
        intent: 'image',
        lang,
        answer: { text: img.message, title: '', provider: img.provider },
        image: img,
        agents: selection.agents,
        agentsCount: selection.count,
        results: [],
        providers: [],
      },
      200,
      cors
    );
  }

  const selection = selectAgentsForTask({
    query: searchQuery,
    allMode: !!body.allAgents || !!body.allMode,
  });
  const pipeline = runAgentContributions(searchQuery, selection, { deep });

  if (useRag) {
    const data = await runRAG(searchQuery, {
      deep: deep || pipeline.boosts.preferDeep,
      env,
      lang,
      history,
      context: ctx,
      intent: selection.intent,
      agentPipeline: pipeline,
    });
    data.resolvedQuery = searchQuery;
    data.originalQuery = raw;
    data.detectedLang = detected;
    data.answerLang = lang;
    data.followUp = ctx.followUp;
    data.contextEntity = ctx.entity;
    data.contextTopic = ctx.topic;
    data.contextDomain = ctx.domain;
    data.lang = lang;
    data.intent = selection.intent;
    data.agents = selection.agents;
    data.agentsCount = selection.count;
    if (selection.curriculum) data.curriculum = selection.curriculum;
    data.agentPipeline = {
      intent: pipeline.intent,
      domains: pipeline.domains,
      agentCount: pipeline.agentCount,
      boosts: pipeline.boosts,
      contributions: body.debugAgents ? pipeline.contributions : pipeline.contributions.slice(0, 8),
    };
    return json(data, 200, cors);
  }

  const data = await modularSearch(searchQuery, { deep, env, lang, context: ctx });
  data.resolvedQuery = searchQuery;
  data.originalQuery = raw;
  data.detectedLang = detected;
  data.answerLang = lang;
  data.followUp = ctx.followUp;
  data.contextEntity = ctx.entity;
  data.lang = lang;
  data.intent = selection.intent;
  data.agents = selection.agents;
  data.agentsCount = selection.count;
  if (selection.curriculum) data.curriculum = selection.curriculum;
  return json(data, 200, cors);
}

async function handleRAG(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const raw = String(body.query || body.q || body.prompt || '').trim();
  const deep = !!body.deep;
  const history = body.history || [];
  if (!raw) return json({ error: 'empty_query' }, 400, cors);
  const ctx = buildConversationContext(raw, history);
  const lang = resolveLang(body, raw);
  const selection = selectAgentsForTask({ query: ctx.query, allMode: !!body.allAgents });
  const pipeline = runAgentContributions(ctx.query, selection, { deep });
  await logSpider(env, 'rag_query', null, request);
  const data = await runRAG(ctx.query, {
    deep: deep || pipeline.boosts.preferDeep,
    env,
    lang,
    history,
    context: ctx,
    intent: selection.intent,
  });
  data.resolvedQuery = ctx.query;
  data.followUp = ctx.followUp;
  data.contextEntity = ctx.entity;
  data.contextTopic = ctx.topic;
  data.contextDomain = ctx.domain;
  data.intent = selection.intent;
  data.agentsCount = selection.count;
  data.lang = lang;
  if (selection.curriculum) data.curriculum = selection.curriculum;
  return json(data, 200, cors);
}

async function handleImage(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt || body.query || '').trim();
  if (!prompt) return json({ error: 'empty_prompt' }, 400, cors);
  const lang = resolveLang(body, prompt);
  await logSpider(env, 'image_gen', null, request);
  const img = await generateImage(prompt, { env, lang });
  const selection = selectAgentsForTask({ query: prompt, intent: 'image' });
  return json({ ...img, intent: 'image', agents: selection.agents, agentsCount: selection.count, lang }, 200, cors);
}

async function handleOrchestrate(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt || body.query || '').trim();
  const deep = !!body.deep;
  const doSearch = body.search !== false;
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const history = body.history || [];
  if (!prompt && !attachments.length) return json({ error: 'empty_prompt' }, 400, cors);

  const ctx = buildConversationContext(prompt, history);
  const lang = resolveLang(body, prompt);

  if (isImageRequest(prompt)) {
    const img = await generateImage(prompt, { env, lang });
    const selection = selectAgentsForTask({ query: prompt, intent: 'image', allMode: !!body.allAgents });
    return json(
      {
        ok: true,
        intent: 'image',
        image: img,
        agents: selection.agents,
        agentsCount: selection.count,
        search: {
          ok: true,
          mode: 'image',
          answer: { text: img.message, title: '', provider: img.provider, grounded: false },
          results: [],
          lang,
        },
        conversation: {
          lang,
          mode: 'image',
          followUp: false,
          resolvedQuery: prompt,
          entity: null,
          topic: null,
          domain: null,
          historyTurns: Array.isArray(history) ? history.length : 0,
        },
        plan: { mode: 'image', steps: [], stack: [], sources: [] },
      },
      200,
      cors
    );
  }

  let search = null;
  if (doSearch && ctx.query) {
    search = await runRAG(ctx.query, { deep, env, lang, history, context: ctx });
    search.resolvedQuery = ctx.query;
    search.followUp = ctx.followUp;
    search.contextEntity = ctx.entity;
    search.contextTopic = ctx.topic;
    search.contextDomain = ctx.domain;
    search.lang = lang;
  }

  let entity = ctx.entity || null;
  if (!entity && search && search.answer && search.answer.title) {
    entity = String(search.answer.title).replace(/\s*\((IT|EN|[A-Z]{2})\)\s*$/i, '').trim();
  }

  const allMode = !!body.allAgents || !!body.allMode;
  const selection = selectAgentsForTask({ query: ctx.query || prompt, allMode });
  const pipeline = runAgentContributions(ctx.query || prompt, selection, { deep });
  const plan = buildPlan(prompt, attachments, deep, search);
  plan.agents = selection.agents;
  plan.intent = selection.intent;
  plan.domains = selection.domains;

  return json(
    {
      ok: true,
      plan,
      intent: selection.intent,
      agents: selection.agents,
      agentsCount: selection.count,
      agentPipeline: pipeline,
      curriculum: selection.curriculum,
      search,
      conversation: {
        followUp: ctx.followUp,
        resolvedQuery: ctx.query,
        entity,
        topic: ctx.topic,
        domain: ctx.domain,
        lang,
        historyTurns: Array.isArray(history) ? history.length : 0,
        mode: 'rag',
      },
    },
    200,
    cors
  );
}

function buildPlan(prompt, attachments, deep, search) {
  const ql = (prompt || '').toLowerCase();
  const stack = [];
  if (/sito|web|landing|react|next|frontend|pagina/.test(ql)) stack.push('Next.js + Tailwind');
  if (/api|backend|server|fastapi|node/.test(ql)) stack.push('FastAPI / Node');
  if (/database|db|postgres|sql|supabase/.test(ql)) stack.push('PostgreSQL');
  if (/app|mobile|flutter|android|ios/.test(ql)) stack.push('Flutter');
  if (/login|auth|oauth|mfa/.test(ql)) stack.push('Auth JWT + MFA');
  if (/cloudflare|deploy|aws/.test(ql)) stack.push('Cloudflare Workers');
  if (!stack.length) stack.push('Next.js + Tailwind', 'Cloudflare Workers');
  const sources =
    search && search.rag && search.rag.sources
      ? search.rag.sources
      : search && search.results
        ? search.results.slice(0, deep ? 8 : 5).map((r) => ({
            title: r.title,
            url: r.url,
            provider: r.provider,
            snippet: (r.snippet || '').slice(0, 200),
          }))
        : [];
  return {
    mode: deep ? 'deep-rag' : 'rag',
    prompt,
    attachments: attachments.map((a) => (typeof a === 'string' ? a : a.name || 'file')),
    stack,
    steps: ['Intent', 'Route agents', 'Retrieve', 'Rank', 'Augment', 'Generate'],
    sources,
    providersUsed: search ? search.providers : [],
    policy: search ? search.policy : null,
    generatedAt: Date.now(),
  };
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}

function requireKv(env) {
  if (!env.AUTH_KV) {
    const err = new Error('AUTH_KV binding missing');
    err.code = 'no_kv';
    throw err;
  }
}

function pepper(env) {
  return env.PEPPER || 'DEV-ONLY-CHANGE-ME-widowblue-pepper';
}

function isAdmin(email) {
  return (email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

async function pbkdf2(password, saltBytes, env) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(password + pepper(env)),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 210000, hash: 'SHA-256' },
    material,
    256
  );
  return new Uint8Array(bits);
}

function b64(u8) {
  let s = '';
  u8.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function fromB64(s) {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a[i] ^ b[i];
  return x === 0;
}

function randomToken(bytes = 32) {
  const u8 = crypto.getRandomValues(new Uint8Array(bytes));
  return [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function register(request, env, cors) {
  requireKv(env);
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email.includes('@') || email.length > 254) return json({ error: 'invalid_email' }, 400, cors);
  if (password.length < 12) return json({ error: 'weak_password', message: 'min 12 characters' }, 400, cors);
  const userKey = 'user:' + email;
  if (await env.AUTH_KV.get(userKey)) return json({ error: 'email_taken' }, 409, cors);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, env);
  const role = isAdmin(email) ? 'superadmin' : 'user';
  await env.AUTH_KV.put(
    userKey,
    JSON.stringify({ email, salt: b64(salt), hash: b64(hash), role, created: Date.now(), fails: 0, lockedUntil: 0 })
  );
  const token = await createSession(env, email, role);
  return json({ ok: true, email, role, token }, 201, cors);
}

async function login(request, env, cors) {
  requireKv(env);
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const userKey = 'user:' + email;
  const raw = await env.AUTH_KV.get(userKey);
  if (!raw) {
    await logSpider(env, 'login_unknown_user', email, request);
    return json({ error: 'invalid_credentials' }, 401, cors);
  }
  const user = JSON.parse(raw);
  if (user.lockedUntil && Date.now() < user.lockedUntil) {
    await logSpider(env, 'login_locked', email, request);
    return json({ error: 'locked', message: 'too many failures' }, 429, cors);
  }
  const hash = await pbkdf2(password, fromB64(user.salt), env);
  if (!timingSafeEqual(hash, fromB64(user.hash))) {
    user.fails = (user.fails || 0) + 1;
    if (user.fails >= MAX_FAIL) {
      user.lockedUntil = Date.now() + LOCK_SEC * 1000;
      user.fails = 0;
      await logSpider(env, 'account_lockout', email, request);
    }
    await env.AUTH_KV.put(userKey, JSON.stringify(user));
    await logSpider(env, 'login_fail', email, request);
    return json({ error: 'invalid_credentials' }, 401, cors);
  }
  user.fails = 0;
  user.lockedUntil = 0;
  user.lastLogin = Date.now();
  await env.AUTH_KV.put(userKey, JSON.stringify(user));
  const role = user.role || (isAdmin(email) ? 'superadmin' : 'user');
  const token = await createSession(env, email, role);
  return json({ ok: true, email, role, token }, 200, cors);
}

async function createSession(env, email, role) {
  const token = randomToken(32);
  await env.AUTH_KV.put(
    'sess:' + token,
    JSON.stringify({ email, role, exp: Date.now() + SESSION_TTL_SEC * 1000 }),
    { expirationTtl: SESSION_TTL_SEC }
  );
  return token;
}

async function getSession(env, request) {
  requireKv(env);
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  const raw = await env.AUTH_KV.get('sess:' + token);
  if (!raw) return null;
  const sess = JSON.parse(raw);
  if (sess.exp && Date.now() > sess.exp) {
    await env.AUTH_KV.delete('sess:' + token);
    return null;
  }
  return sess;
}

async function logout(request, env, cors) {
  requireKv(env);
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (token) await env.AUTH_KV.delete('sess:' + token);
  return json({ ok: true }, 200, cors);
}

async function me(request, env, cors) {
  try {
    const sess = await getSession(env, request);
    if (!sess) return json({ error: 'unauthorized' }, 401, cors);
    return json({ ok: true, email: sess.email, role: sess.role }, 200, cors);
  } catch (e) {
    if (e.code === 'no_kv') return json({ error: 'kv_not_configured' }, 503, cors);
    throw e;
  }
}

async function timedKey(request, env, cors) {
  try {
    const sess = await getSession(env, request);
    if (!sess || sess.role !== 'superadmin') return json({ error: 'forbidden' }, 403, cors);
    const key = randomToken(16);
    const ttl = 90;
    await env.AUTH_KV.put('timed:' + key, JSON.stringify({ by: sess.email, exp: Date.now() + ttl * 1000 }), {
      expirationTtl: ttl,
    });
    return json({ ok: true, key, ttlSec: ttl }, 200, cors);
  } catch (e) {
    if (e.code === 'no_kv') return json({ error: 'kv_not_configured' }, 503, cors);
    throw e;
  }
}

async function logSpider(env, event, email, request) {
  try {
    if (!env.AUTH_KV) return;
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const entry = { event, email, ip, at: Date.now(), ua: (request.headers.get('User-Agent') || '').slice(0, 120) };
    await env.AUTH_KV.put('spider:' + Date.now() + ':' + randomToken(4), JSON.stringify(entry), {
      expirationTtl: 60 * 60 * 24 * 14,
    });
  } catch (_) {}
}
