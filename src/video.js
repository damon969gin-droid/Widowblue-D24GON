/**
 * WidowBlue – generazione video via JSON2Video
 * Secret: JSON2VIDEO_API_KEY (o J2V_API_KEY)
 */

export function isVideoRequest(prompt) {
  const t = String(prompt || '').toLowerCase();
  // Parole esplicite video
  if (/\b(video|filmato|videoclip|reel|short|movie|clip)\b/i.test(t)) return true;
  // Genera/crea + animazione / motion / scritta animata
  if (
    /\b(genera|generami|crea|creami|fai|make|generate|create|realizza)\b/i.test(t) &&
    /\b(animat[oaie]|animazione|motion\s*graphics?|logo\s*animat|testo\s*animat|scritta\s*animat|tipo\s*cinetico)\b/i.test(t)
  ) {
    return true;
  }
  // genera/crea + scritta/testo + (appare|animat|schermo)
  if (
    /\b(genera|crea|fai|make|generate)\b/i.test(t) &&
    /\b(scritta|testo|titolo)\b/i.test(t) &&
    /\b(animat|video|appare|compar)/i.test(t)
  ) {
    return true;
  }
  if (/\b(json2video|json\s*2\s*video)\b/i.test(t)) return true;
  return false;
}

export function extractVideoPrompt(prompt) {
  let s = String(prompt || '').trim();
  s = s
    .replace(/^(per\s+favore\s+|please\s+)/i, '')
    .replace(
      /^(generami|genera|crea|creami|fai|make|generate|create|realizza)\s+(un[oa]?\s+)?(video|clip|movie|filmato|reel|short|videoclip)?\s*(animat[oaie]?\s*)?(di|of|about|su|per|con|:)?\s*/i,
      ''
    )
    .replace(/^(un[oa]?\s+)?(video|clip|movie|filmato)\s*(animat[oaie]?\s*)?(di|of|about|su|per|:)?\s*/i, '')
    .trim();
  const quoted = s.match(/["«]([^"»]{2,120})["»]/);
  if (quoted) return quoted[1].trim().slice(0, 100);
  const scritta = s.match(/(?:scritta|testo|titolo)\s+(?:["«]?)([^"».!?]{2,100})/i);
  if (scritta) return scritta[1].trim().slice(0, 100);
  if (!s || s.length < 2) s = String(prompt || '').trim() || 'WidowBlue';
  return s.slice(0, 100);
}

function getApiKey(env) {
  return (
    (env &&
      (env.JSON2VIDEO_API_KEY ||
        env.J2V_API_KEY ||
        env.JSON2VIDEO_KEY ||
        env.JSON_2_VIDEO_API_KEY)) ||
    ''
  );
}

function buildMovieJson(text) {
  const title = String(text || 'WidowBlue').slice(0, 100);
  return {
    resolution: 'full-hd',
    scenes: [
      {
        duration: 6,
        elements: [
          {
            type: 'text',
            text: title,
            style: '001',
            duration: 6,
          },
        ],
      },
    ],
  };
}

export async function generateVideo(prompt, opts = {}) {
  const env = opts.env || {};
  const lang = opts.lang || 'it';
  const apiKey = getApiKey(env);
  if (!apiKey) {
    return {
      ok: false,
      error: 'missing_json2video_key',
      message:
        lang === 'it'
          ? 'Secret JSON2VIDEO_API_KEY mancante su Cloudflare Pages (Settings → Variables and Secrets). Nome esatto: JSON2VIDEO_API_KEY'
          : 'Missing JSON2VIDEO_API_KEY secret on Cloudflare Pages.',
    };
  }

  const subject = extractVideoPrompt(prompt);
  const body =
    opts.movieJson && typeof opts.movieJson === 'object'
      ? opts.movieJson
      : buildMovieJson(subject);

  let res;
  try {
    res = await fetch('https://api.json2video.com/v2/movies', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: 'network', message: String(e && e.message ? e.message : e) };
  }

  const rawText = await res.text().catch(() => '');
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (_) {
    data = { raw: rawText };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: 'json2video_http_' + res.status,
      message: String(rawText || data.message || 'JSON2Video error').slice(0, 400),
    };
  }

  const project = data.project || data.projectId || (data.movie && data.movie.project);
  if (!project) {
    return { ok: false, error: 'no_project_id', message: String(rawText).slice(0, 300) };
  }

  if (opts.wait === true) {
    const maxTries = Math.min(Number(opts.maxPolls) || 4, 6);
    let movie = null;
    for (let i = 0; i < maxTries; i++) {
      await sleep(i === 0 ? 2500 : 3500);
      movie = await pollMovie(apiKey, project);
      if (movie && (movie.status === 'done' || movie.status === 'error' || movie.status === 'timeout'))
        break;
    }
    if (movie && movie.status === 'done') {
      const url = movie.url || movie.result || null;
      return {
        ok: true,
        project,
        status: 'done',
        url,
        videoUrl: url,
        thumbnail: movie.thumbnail || null,
        message:
          lang === 'it'
            ? 'Video generato: ' + subject
            : 'Video generated: ' + subject,
        subject,
        provider: 'json2video',
      };
    }
    if (movie && movie.status === 'error') {
      return {
        ok: false,
        project,
        status: 'error',
        message: movie.message || (lang === 'it' ? 'Errore nel render video.' : 'Video render error.'),
        provider: 'json2video',
      };
    }
  }

  return {
    ok: true,
    project,
    status: 'queued',
    url: null,
    videoUrl: null,
    message:
      lang === 'it'
        ? 'Video in elaborazione… testo: «' + subject + '» (id: ' + project + ')'
        : 'Video processing… text: «' + subject + '» (id: ' + project + ')',
    subject,
    provider: 'json2video',
  };
}

export async function getVideoStatus(projectId, opts = {}) {
  const env = opts.env || {};
  const apiKey = getApiKey(env);
  if (!apiKey) return { ok: false, error: 'missing_json2video_key' };
  if (!projectId) return { ok: false, error: 'missing_project' };
  const movie = await pollMovie(apiKey, projectId);
  if (!movie) return { ok: false, error: 'poll_failed', project: projectId };
  const url = movie.url || movie.result || null;
  return {
    ok: true,
    project: projectId,
    status: movie.status,
    url,
    videoUrl: url,
    thumbnail: movie.thumbnail || null,
    message: movie.message || null,
    provider: 'json2video',
  };
}

async function pollMovie(apiKey, projectId) {
  try {
    const res = await fetch(
      'https://api.json2video.com/v2/movies?project=' + encodeURIComponent(projectId),
      { headers: { 'x-api-key': apiKey, Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.movie || data;
  } catch (_) {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
