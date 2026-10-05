/**
 * WidowBlue Worker – API entry
 */

import { modularSearch } from './search.js';
import { runRAG } from './rag.js';
import { generateImage } from './image.js';
import { generateVideo, getVideoStatus, isVideoRequest } from './video.js';
import { selectAgentsForTask, runAgentContributions } from './agents.js';
import { buildConversationContext } from './context.js';
import { resolveLang, detectLang, translateText, forceLang } from './lang.js';
import { guardInput, guardOutput, guardrailPolicy } from './guardrails.js';
import { cacheLookup, cacheStore } from './semantic_cache.js';
import { planTools } from './tools.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function json(data, status = 200, cors = CORS) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    try {
      if (path === '/api/search' || path === '/api/query') return await handleSearch(request, env, CORS);
      if (path === '/api/rag') return await handleRAG(request, env, CORS);
      if (path === '/api/image') return await handleImage(request, env, CORS);
      if (path === '/api/video') return await handleVideo(request, env, CORS);
      if (path === '/api/video/status') return await handleVideoStatus(request, env, CORS);
      if (path === '/api/orchestrate') return await handleOrchestrate(request, env, CORS);
      if (path === '/api/health') return json({ ok: true, ts: Date.now() }, 200, CORS);
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return json({ error: 'not_found', path }, 404, CORS);
    } catch (e) {
      return json({ error: 'server_error', message: String(e && e.message ? e.message : e) }, 500, CORS);
    }
  },
};

async function handleSearch(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const raw = String(body.query || body.prompt || body.q || '').trim();
  const atts = Array.isArray(body.attachments) ? body.attachments : [];
  if (!raw && !atts.length) return json({ error: 'empty_query' }, 400, cors);

  const guarded = guardInput(raw || 'allegati');
  if (guarded.blocked) {
    return json({ ok: false, error: 'blocked', reason: guarded.reason }, 400, cors);
  }
  const safeQuery = guarded.text || raw;

  const lang = resolveLang(body, raw || 'it');
  const detected = detectLang(raw || 'it');
  let searchQuery = safeQuery;

  if (isVideoRequest(raw) || (atts.some((a) => a && String(a.type || '').startsWith('image/')) && /\b(video|animat)/i.test(raw))) {
    const imgAtt = atts.find((a) => a && a.dataUrl && String(a.type || '').startsWith('image/'));
    const httpsImg = atts.find((a) => a && a.url && /^https?:\/\//i.test(String(a.url)));
    const vid = await generateVideo(raw || 'video da immagine', {
      env,
      lang,
      wait: false,
      imageUrl: (httpsImg && httpsImg.url) || (imgAtt && imgAtt.dataUrl) || undefined,
      withText: /\b(scritta|testo|titolo|overlay)\b/i.test(raw),
    });
    return json(
      {
        ok: !!vid.ok,
        mode: 'video',
        video: vid,
        answer: {
          text:
            vid.message ||
            (lang === 'it' ? 'Richiesta video inviata.' : 'Video request submitted.'),
        },
        videoUrl: vid.url || vid.videoUrl || null,
        lang,
      },
      vid.ok ? 200 : 502,
      cors
    );
  }

  if (/\b(genera|generate|crea|draw|immagine|image|foto|picture)\b/i.test(raw) && /\b(immagine|image|foto|picture|logo|icon)\b/i.test(raw)) {
    const img = await generateImage(raw, { env, lang });
    return json(
      {
        ok: true,
        mode: 'image',
        image: img,
        answer: { text: lang === 'it' ? 'Immagine generata.' : 'Image generated.' },
        lang,
      },
      200,
      cors
    );
  }

  try {
    const cached = await cacheLookup(safeQuery, { lang, env });
    if (cached && cached.text) {
      return json(
        {
          ok: true,
          mode: 'cache',
          answer: { text: cached.text, provider: 'cache', grounded: true },
          lang,
          cached: true,
        },
        200,
        cors
      );
    }
  } catch (_) {}

  const history = Array.isArray(body.history) ? body.history : [];
  const ctx = buildConversationContext(searchQuery, history);
  const deep = body.deep !== false;
  const useRag = body.rag !== false;

  const selection = selectAgentsForTask({
    query: searchQuery,
    allMode: !!body.allAgents || !!body.allMode,
  });
  const pipeline = runAgentContributions(searchQuery, selection, { deep });

  if (useRag) {
    const data = await runRAG(searchQuery, {
      deep: deep || (pipeline.boosts && pipeline.boosts.preferDeep),
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
    try {
      if (data.answer && data.answer.text && lang && lang !== 'auto') {
        data.answer.text = await forceLang(data.answer.text, lang);
      }
    } catch (_) {}

    if (data.answer && data.answer.text) {
      const go = guardOutput(data.answer.text);
      data.answer.text = go.text;
      if (go.flags && go.flags.length) data.guardFlags = go.flags;
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
      contributions: body.debugAgents ? pipeline.contributions : (pipeline.contributions || []).slice(0, 8),
    };
    data.attachmentsReceived = atts.length;
    return json(data, 200, cors);
  }

  const data = await modularSearch(searchQuery, { deep, env, lang, context: ctx });
  data.resolvedQuery = searchQuery;
  data.originalQuery = raw;
  data.answerLang = lang;
  data.lang = lang;
  try {
    if (data.answer && data.answer.text && lang && lang !== 'auto') {
      data.answer.text = await forceLang(data.answer.text, lang);
    }
  } catch (_) {}
  data.agents = selection.agents;
  data.agentsCount = selection.count;
  return json(data, 200, cors);
}

async function handleRAG(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const raw = String(body.query || body.q || '').trim();
  if (!raw) return json({ error: 'empty_query' }, 400, cors);
  const guarded = guardInput(raw);
  if (guarded.blocked) return json({ ok: false, error: 'blocked' }, 400, cors);
  const lang = resolveLang(body, raw);
  const history = Array.isArray(body.history) ? body.history : [];
  const ctx = buildConversationContext(raw, history);
  const data = await runRAG(ctx.query || raw, { deep: true, env, lang, history, context: ctx });
  try {
    if (data.answer && data.answer.text && lang && lang !== 'auto') {
      data.answer.text = await forceLang(data.answer.text, lang);
    }
  } catch (_) {}
  if (data.answer && data.answer.text) {
    try {
      await cacheStore(raw, data.answer.text, { lang, env });
    } catch (_) {}
  }
  data.lang = lang;
  return json(data, 200, cors);
}

async function handleVideo(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt || body.query || '').trim();
  const movieJson = body.movie || body.movieJson || null;
  const atts = Array.isArray(body.attachments) ? body.attachments : [];
  if (!prompt && !movieJson && !atts.length) return json({ error: 'empty_prompt' }, 400, cors);
  const lang = resolveLang(body, prompt || 'video');
  const imgAtt = atts.find((a) => a && (a.dataUrl || a.url) && String(a.type || 'image/').startsWith('image/'));
  const vid = await generateVideo(prompt || 'video', {
    env,
    lang,
    wait: body.wait === true,
    movieJson: movieJson || undefined,
    maxPolls: body.maxPolls,
    imageUrl: body.imageUrl || (imgAtt && (imgAtt.url || imgAtt.dataUrl)) || undefined,
    withText: body.withText === true,
  });
  const selection = selectAgentsForTask({ query: prompt || 'video', intentHint: 'video' });
  return json(
    {
      ...vid,
      intent: 'video',
      agents: selection.agents,
      agentsCount: selection.count,
      lang,
    },
    vid.ok ? 200 : 502,
    cors
  );
}

async function handleVideoStatus(request, env, cors) {
  const url = new URL(request.url);
  let project = url.searchParams.get('project') || '';
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    project = String(body.project || project || '').trim();
  }
  if (!project) return json({ error: 'missing_project' }, 400, cors);
  const st = await getVideoStatus(project, { env });
  return json(st, st.ok ? 200 : 502, cors);
}

async function handleImage(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt || body.query || '').trim();
  if (!prompt) return json({ error: 'empty_prompt' }, 400, cors);
  const lang = resolveLang(body, prompt);
  const img = await generateImage(prompt, { env, lang });
  const selection = selectAgentsForTask({ query: prompt, intentHint: 'image' });
  return json({ ...img, intent: 'image', agents: selection.agents, agentsCount: selection.count, lang }, 200, cors);
}

async function handleOrchestrate(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt || body.query || '').trim();
  if (!prompt) return json({ error: 'empty_query' }, 400, cors);
  const lang = resolveLang(body, prompt);
  const history = Array.isArray(body.history) ? body.history : [];
  const ctx = buildConversationContext(prompt, history);
  const deep = body.deep !== false;
  let search = null;
  try {
    search = await runRAG(ctx.query || prompt, { deep, env, lang, history, context: ctx });
    try {
      if (search.answer && search.answer.text && lang && lang !== 'auto') {
        search.answer.text = await forceLang(search.answer.text, lang);
      }
    } catch (_) {}
    if (search.answer && search.answer.text) {
      try {
        await cacheStore(ctx.query || prompt, search.answer.text, { lang, env });
      } catch (_) {}
    }
  } catch (e) {
    search = { ok: false, error: String(e && e.message) };
  }
  const tools = planTools(prompt);
  return json(
    {
      ok: true,
      search,
      tools,
      lang,
      contextEntity: ctx.entity,
      contextTopic: ctx.topic,
    },
    200,
    cors
  );
}
