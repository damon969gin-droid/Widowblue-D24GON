/**
 * WidowBlue – generazione video via JSON2Video (solo testo)
 * Secret: JSON2VIDEO_API_KEY
 */

export function isVideoRequest(prompt) {
  const t = String(prompt || '').toLowerCase();
  if (/\b(video|filmato|videoclip|reel|short|movie|clip)\b/i.test(t)) return true;
  if (
    /\b(genera|generami|crea|creami|fai|make|generate|create|realizza)\b/i.test(t) &&
    /\b(animat[oaie]|animazione|motion\s*graphics?|logo\s*animat|testo\s*animat|scritta\s*animat|tipo\s*cinetico)\b/i.test(t)
  ) {
    return true;
  }
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
    .replace(/\b(con\s+solo\s+testo|solo\s+testo|only\s+text)\b/gi, '')
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

/** Video full-hd: solo testo ciano su sfondo scuro */
function buildMovieJson(text) {
  const title = String(text || 'WidowBlue').slice(0, 100);
  return {
    resolution: 'full-hd',
    quality: 'high',
    scenes: [
      {
        duration: 7,
        'background-color': '#040a12',
        elements: [
          {
            type: 'text',
            text: title,
            duration: 7,
            style: '001',
            'font-size': 72,
            'font-color': '#4de1ff',
            'font-family': 'Roboto',
            'text-align': 'center',
            x: 0,
            y: 0,
            width: '100%',
            height: '100%',
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
          ? 'Secret JSON2VIDEO_API_KEY mancante su Cloudflare.'
          : 'Missing JSON2VIDEO_API_KEY secret.',
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

  return {
    ok: true,
    project,
    status: 'queued',
    url: null,
    videoUrl: null,
    message:
      lang === 'it'
        ? 'Video in elaborazione… testo: «' + subject + '» — attendi 5–15 secondi'
        : 'Video processing… text: «' + subject + '» — wait 5–15s',
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
