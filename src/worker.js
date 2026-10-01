/**
 * WidowBlue Worker – Auth + Search + Orchestrator + conversation context
 * Superadmin: giorgi.daniele96@gmail.com
 */

import { modularSearch } from './search.js';

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
      return json(
        {
          ok: true,
          service: 'widowblue',
          conversation: true,
          kv: !!env.AUTH_KV,
          tavily: !!env.TAVILY_API_KEY,
          serper: !!env.SERPER_API_KEY,
          brave: !!env.BRAVE_API_KEY,
          google: !!(env.GOOGLE_API_KEY && env.GOOGLE_CSE_ID),
          bing: !!env.BING_API_KEY,
          perplexity: !!env.PERPLEXITY_API_KEY,
          endpoints: ['/api/health', '/api/auth/*', '/api/search', '/api/orchestrate'],
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

    if (url.pathname === '/api/search' && request.method === 'POST') {
      return handleSearch(request, env, cors);
    }

    if (url.pathname === '/api/orchestrate' && request.method === 'POST') {
      return handleOrchestrate(request, env, cors);
    }

    return json({ error: 'not_found' }, 404, cors);
  } catch (e) {
    return json({ error: 'server_error', message: String(e.message || e) }, 500, cors);
  }
}

/** Continua il discorso: arricchisce follow-up con contesto precedente */
function resolveWithHistory(prompt, history) {
  const p = String(prompt || '').trim();
  if (!p) return { query: p, entity: null, followUp: false };

  const hist = Array.isArray(history) ? history.slice(-12) : [];
  let entity = null;
  for (let i = hist.length - 1; i >= 0; i--) {
    const h = hist[i];
    if (h && h.entity) {
      entity = String(h.entity).trim();
      break;
    }
  }
  if (!entity) {
    for (let i = hist.length - 1; i >= 0; i--) {
      const h = hist[i];
      if (h && h.role === 'user' && h.text) {
        // ultima domanda utente sostanziale
        const t = String(h.text).trim();
        if (t.length > 8) {
          entity = t
            .replace(/^(quando|chi|cosa|come|dove|perché|perche|what|when|who|where|why)\b[\s\S]{0,20}/i, '')
            .replace(/\?+$/g, '')
            .trim();
          if (entity.length > 2) break;
        }
      }
    }
  }

  const followUp =
    p.length < 70 ||
    /^(e |ed |ma |poi |anche |quindi |invece |però |pero |e lui|e lei|e dopo|and |but |then |also |why |how |when |where )/i.test(
      p
    ) ||
    /^(quando|dove|come|perché|perche|chi|cosa)\b/i.test(p);

  let query = p;
  if (followUp && entity && !p.toLowerCase().includes(entity.toLowerCase().slice(0, 12))) {
    query = entity + ' — ' + p;
  }

  return { query, entity, followUp };
}

async function handleSearch(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const raw = String(body.query || body.q || '').trim();
  const deep = !!body.deep;
  const history = body.history || [];
  if (!raw) return json({ error: 'empty_query' }, 400, cors);
  const resolved = resolveWithHistory(raw, history);
  await logSpider(env, 'search_query', null, request);
  const data = await modularSearch(resolved.query, { deep, env });
  data.resolvedQuery = resolved.query;
  data.followUp = resolved.followUp;
  data.contextEntity = resolved.entity;
  return json(data, 200, cors);
}

async function handleOrchestrate(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt || body.query || '').trim();
  const deep = !!body.deep;
  const doSearch = body.search !== false;
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const history = body.history || [];
  if (!prompt && !attachments.length) return json({ error: 'empty_prompt' }, 400, cors);

  const resolved = resolveWithHistory(prompt, history);
  let search = null;
  if (doSearch && resolved.query) {
    search = await modularSearch(resolved.query, { deep, env });
    search.resolvedQuery = resolved.query;
    search.followUp = resolved.followUp;
    search.contextEntity = resolved.entity;
  }

  // Entity per prossima domanda: titolo risposta
  let entity =
    (search && search.answer && search.answer.title) ||
    resolved.entity ||
    null;
  if (entity) entity = String(entity).replace(/\s*\((IT|EN)\)\s*$/i, '').trim();

  const plan = buildPlan(prompt, attachments, deep, search);
  return json(
    {
      ok: true,
      plan,
      search,
      conversation: {
        followUp: resolved.followUp,
        resolvedQuery: resolved.query,
        entity,
        historyTurns: Array.isArray(history) ? history.length : 0,
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
    search && search.results
      ? search.results.slice(0, deep ? 8 : 5).map((r) => ({
          title: r.title,
          url: r.url,
          provider: r.provider,
          snippet: (r.snippet || '').slice(0, 200),
        }))
      : [];
  return {
    mode: deep ? 'deep' : 'standard',
    prompt,
    attachments: attachments.map((a) => (typeof a === 'string' ? a : a.name || 'file')),
    stack,
    steps: deep
      ? ['Ricerca contestuale', 'Sintesi', 'Fonti']
      : ['Ricerca', 'Sintesi'],
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
  return { ...sess, token };
}

async function logout(request, env, cors) {
  requireKv(env);
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (token) await env.AUTH_KV.delete('sess:' + token);
  return json({ ok: true }, 200, cors);
}

async function me(request, env, cors) {
  const sess = await getSession(env, request);
  if (!sess) return json({ error: 'unauthorized' }, 401, cors);
  return json({ email: sess.email, role: sess.role, isAdmin: isAdmin(sess.email) }, 200, cors);
}

async function timedKey(request, env, cors) {
  const sess = await getSession(env, request);
  if (!sess || !isAdmin(sess.email)) return json({ error: 'forbidden' }, 403, cors);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';
  const arr = crypto.getRandomValues(new Uint8Array(20));
  let key = '';
  for (let i = 0; i < 20; i++) key += chars[arr[i] % chars.length];
  const ttl = 60;
  await env.AUTH_KV.put('tkey:' + key, JSON.stringify({ email: sess.email, exp: Date.now() + ttl * 1000 }), {
    expirationTtl: ttl,
  });
  await logSpider(env, 'timed_key_issued', sess.email, request);
  return json({ key, expiresIn: ttl }, 200, cors);
}

async function logSpider(env, type, email, request) {
  if (!env.AUTH_KV) return;
  const id = 'spider:' + Date.now() + ':' + randomToken(4);
  await env.AUTH_KV.put(
    id,
    JSON.stringify({
      type,
      email: email || null,
      ip: request.headers.get('CF-Connecting-IP') || null,
      ua: request.headers.get('User-Agent') || null,
      at: Date.now(),
    }),
    { expirationTtl: 60 * 60 * 24 * 30 }
  );
}
