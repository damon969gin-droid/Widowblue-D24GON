/**
 * WidowBlue Worker – Auth + Search + RAG + Image + Orchestrator + Agents + D1
 * Superadmin: giorgi.daniele96@gmail.com
 * Features: guardrails, semantic cache, tool-calling plan
 */

import { modularSearch } from './search.js';
import { runRAG } from './rag.js';
import { isImageRequest, generateImage } from './image.js';
import { buildConversationContext } from './context.js';
import { agentStats, selectAgentsForTask, runAgentContributions, detectIntent, getAgentCatalog, curriculumSummary, matchCurriculum } from './agents.js';
import { hasDB, dbHealth, listAgents, ensureAgentsSeeded, logSearch } from './db.js';
import { resolveLang, detectLang, translateText } from './lang.js';
import { guardInput, guardOutput, guardrailPolicy } from './guardrails.js';
import { cacheLookup, cacheStore, cacheStats } from './semantic_cache.js';
import { planTools, runTools, toolsCatalog } from './tools.js';

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
    return new Response('WidowBlue Worker OK', { status: 200 });
  },
};

async function handleApi(request, env, url) {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  try {
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json(
        {
          ok: true,
          service: 'widowblue',
          agents: agentStats().total,
          agentDomains: agentStats().byDomain,
          curriculum: curriculumSummary(),
          tools: toolsCatalog().map((t) => t.name),
          cache: cacheStats(),
          policy: guardrailPolicy(),
          db: hasDB(env),
        },
        200,
        cors
      );
    }

    if (url.pathname === '/api/tools' && request.method === 'GET') {
      return json({ ok: true, tools: toolsCatalog(), cache: cacheStats(), policy: guardrailPolicy() }, 200, cors);
    }

    if (url.pathname === '/api/agents' && request.method === 'GET') {
      let data = { agents: getAgentCatalog(), stats: agentStats() };
      const domain = url.searchParams.get('domain');
      if (domain && data.agents) {
        data.agents = data.agents.filter((a) => a.domain === domain || !a.domain);
      }
      return json({ ok: true, ...data }, 200, cors);
    }

    if (url.pathname === '/api/agents/stats' && request.method === 'GET') {
      const stats = agentStats();
      const sample = selectAgentsForTask({ query: 'demo', allMode: false });
      return json(
        {
          ok: true,
          stats,
          sampleTeam: sample.agents.slice(0, 12),
          curriculum: curriculumSummary(),
        },
        200,
        cors
      );
    }

    if (url.pathname === '/api/search' && request.method === 'POST') return handleSearch(request, env, cors);
    if (url.pathname === '/api/rag' && request.method === 'POST') return handleRAG(request, env, cors);
    if (url.pathname === '/api/image' && request.method === 'POST') return handleImage(request, env, cors);
    if (url.pathname === '/api/orchestrate' && request.method === 'POST') return handleOrchestrate(request, env, cors);

    return json({ error: 'not_found', path: url.pathname }, 404, cors);
  } catch (e) {
    return json({ error: 'server_error', message: String(e.message || e) }, 500, cors);
  }
}

async function handleSearch(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const raw = String(body.query || body.q || '').trim();
  const deep = !!body.deep;
  const history = body.history || [];
  const useRag = body.rag !== false;
  if (!raw) return json({ error: 'empty_query' }, 400, cors);

  const lang = resolveLang(body, raw);
  const guarded = guardInput(raw);
  if (guarded.blocked) {
    return json(
      {
        ok: false,
        error: guarded.reason || 'blocked',
        message:
          lang === 'it'
            ? 'Richiesta bloccata dai guardrail di sicurezza (possibile prompt injection).'
            : 'Request blocked by security guardrails (possible prompt injection).',
        policy: guardrailPolicy(),
      },
      400,
      cors
    );
  }
  const safeQuery = guarded.query || raw;
  const ctx = buildConversationContext(safeQuery, history);

  const cached = await cacheLookup(safeQuery, { lang, env });
  if (cached.hit && cached.answer) {
    return json(
      {
        ok: true,
        mode: 'semantic-cache',
        query: safeQuery,
        lang,
        answer: {
          text: typeof cached.answer === 'string' ? cached.answer : cached.answer.text || '',
          grounded: true,
          provider: 'cache',
        },
        cache: { hit: true, score: cached.score, source: cached.source },
        policy: { ...guardrailPolicy(), cache: true },
        fetchedAt: Date.now(),
      },
      200,
      cors
    );
  }

  const detected = detectLang(safeQuery);
  let searchQuery = ctx.query || safeQuery;
  if (body.lang && body.lang !== 'auto' && detected !== lang && searchQuery.length > 2) {
    try {
      const tr = await translateText(searchQuery, detected, lang);
      if (tr && tr.length > 2) searchQuery = tr;
    } catch (_) {}
  }

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
    if (data.answer && data.answer.text) {
      const go = guardOutput(data.answer.text);
      data.answer.text = go.text;
      if (go.flags.length) data.guardFlags = go.flags;
      try {
        await cacheStore(safeQuery, data.answer.text, { lang, env });
      } catch (_) {}
    }
    data.policy = { ...(data.policy || {}), ...guardrailPolicy() };
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
  data.answerLang = lang;
  data.lang = lang;
  data.agents = selection.agents;
  data.agentsCount = selection.count;
  return json(data, 200, cors);
}

async function handleRAG(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const raw = String(body.query || body.q || '').trim();
  if (!raw) return json({ error: 'empty_query' }, 400, cors);
  const guarded = guardInput(raw);
  if (guarded.blocked) {
    return json({ ok: false, error: guarded.reason, policy: guardrailPolicy() }, 400, cors);
  }
  const lang = resolveLang(body, raw);
  const history = body.history || [];
  const ctx = buildConversationContext(guarded.query || raw, history);
  const selection = selectAgentsForTask({ query: ctx.query, allMode: !!body.allAgents });
  const data = await runRAG(ctx.query, { deep: true, env, lang, history, context: ctx });
  if (data.answer && data.answer.text) {
    const go = guardOutput(data.answer.text);
    data.answer.text = go.text;
    try {
      await cacheStore(ctx.query, data.answer.text, { lang, env });
    } catch (_) {}
  }
  data.agents = selection.agents;
  data.agentsCount = selection.count;
  data.policy = { ...(data.policy || {}), ...guardrailPolicy() };
  return json(data, 200, cors);
}

async function handleImage(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt || body.query || '').trim();
  if (!prompt) return json({ error: 'empty_prompt' }, 400, cors);
  const lang = resolveLang(body, prompt);
  const img = await generateImage(prompt, { env, lang });
  const selection = selectAgentsForTask({ query: prompt, intent: 'image' });
  return json({ ...img, intent: 'image', agents: selection.agents, agentsCount: selection.count, lang }, 200, cors);
}

async function handleOrchestrate(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt || body.query || '').trim();
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const deep = body.deep !== false;
  const history = body.history || [];
  if (!prompt && !attachments.length) return json({ error: 'empty_prompt' }, 400, cors);

  const guarded = guardInput(prompt || 'file');
  if (guarded.blocked) {
    return json({ ok: false, error: guarded.reason, policy: guardrailPolicy() }, 400, cors);
  }
  const lang = resolveLang(body, prompt);
  const ctx = buildConversationContext(guarded.query || prompt, history);

  let search = null;
  if (prompt) {
    search = await runRAG(ctx.query, { deep, env, lang, history, context: ctx });
    if (search && search.answer && search.answer.text) {
      const go = guardOutput(search.answer.text);
      search.answer.text = go.text;
      try {
        await cacheStore(ctx.query, search.answer.text, { lang, env });
      } catch (_) {}
    }
  }

  const selection = selectAgentsForTask({ query: ctx.query || prompt, allMode: !!body.allAgents });
  const pipeline = runAgentContributions(ctx.query || prompt, selection, { deep });
  const toolPlan = planTools(prompt);
  const toolResults = await runTools(toolPlan, {
    selectAgents: selectAgentsForTask,
    translate: (text, from, to) => translateText(text, from || 'auto', to || 'it'),
  });
  const plan = buildPlan(prompt, attachments, deep, search);
  plan.tools = toolPlan;
  plan.toolResults = toolResults;
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
        entity: ctx.entity,
        topic: ctx.topic,
        domain: ctx.domain,
        lang,
        historyTurns: Array.isArray(history) ? history.length : 0,
        mode: 'rag',
      },
      policy: guardrailPolicy(),
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
    steps: ['Guard', 'Cache', 'Intent', 'Tools', 'Route agents', 'Retrieve', 'Rank', 'Augment', 'Generate'],
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
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}
