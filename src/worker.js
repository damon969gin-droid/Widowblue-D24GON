/**
 * WidowBlue Worker – Auth API + static frontend assets
 * Superadmin: giorgi.daniele96@gmail.com
 *
 * Bindings (wrangler.toml):
 *   AUTH_KV  – KV namespace for users + sessions
 *   PEPPER   – secret string (wrangler secret put PEPPER)
 */

const ADMIN_EMAIL = 'giorgi.daniele96@gmail.com';
const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days
const MAX_FAIL = 8;
const LOCK_SEC = 15 * 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }

    // Static assets (Workers Assets)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('WidowBlue Worker up. Configure [assets] in wrangler.toml', { status: 200 });
  },
};

async function handleApi(request, env, url) {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'widowblue-auth', kv: !!env.AUTH_KV }, 200, cors);
    }

    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      return register(request, env, cors);
    }
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      return login(request, env, cors);
    }
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      return logout(request, env, cors);
    }
    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      return me(request, env, cors);
    }
    if (url.pathname === '/api/auth/timed-key' && request.method === 'POST') {
      return timedKey(request, env, cors);
    }

    return json({ error: 'not_found' }, 404, cors);
  } catch (e) {
    return json({ error: 'server_error', message: String(e.message || e) }, 500, cors);
  }
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
    const err = new Error('AUTH_KV binding missing. Create KV namespace and bind as AUTH_KV.');
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
  const material = await crypto.subtle.importKey('raw', enc.encode(password + pepper(env)), 'PBKDF2', false, ['deriveBits']);
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
  const existing = await env.AUTH_KV.get(userKey);
  if (existing) return json({ error: 'email_taken' }, 409, cors);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, env);
  const role = isAdmin(email) ? 'superadmin' : 'user';

  const record = {
    email,
    salt: b64(salt),
    hash: b64(hash),
    role,
    created: Date.now(),
    fails: 0,
    lockedUntil: 0,
  };
  await env.AUTH_KV.put(userKey, JSON.stringify(record));

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
  const ok = timingSafeEqual(hash, fromB64(user.hash));
  if (!ok) {
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
  const sess = { email, role, exp: Date.now() + SESSION_TTL_SEC * 1000 };
  await env.AUTH_KV.put('sess:' + token, JSON.stringify(sess), { expirationTtl: SESSION_TTL_SEC });
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
  const entry = {
    type,
    email: email || null,
    ip: request.headers.get('CF-Connecting-IP') || null,
    ua: request.headers.get('User-Agent') || null,
    at: Date.now(),
  };
  await env.AUTH_KV.put(id, JSON.stringify(entry), { expirationTtl: 60 * 60 * 24 * 30 });
}
