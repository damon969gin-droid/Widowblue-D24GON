/**
 * WidowBlue – generazione immagini
 * 1) Cloudflare Workers AI (se binding AI)
 * 2) Pollinations.ai (fallback pubblico, no key)
 */

export function isImageRequest(prompt) {
  const t = String(prompt || '').toLowerCase();
  return (
    /\b(genera|generami|crea|creami|disegna|draw|generate|create|make)\b[\s\S]{0,60}\b(immagin[ei]|image|foto|picture|illustration|illustrazione)\b/i.test(
      t
    ) ||
    /\b(immagin[ei]|image|foto)\b[\s\S]{0,40}\b(di|of|about|su|per)\b/i.test(t) ||
    /^(genera|generami|crea|draw|generate)\s+(un[oa]?\s+)?(immagin[ei]|image|foto)/i.test(t)
  );
}

/** Estrae il soggetto da visualizzare dalla richiesta */
export function extractImagePrompt(prompt) {
  let s = String(prompt || '').trim();
  s = s
    .replace(/^(per\s+favore\s+|please\s+)/i, '')
    .replace(
      /^(generami|genera|crea|creami|disegna|draw|generate|create|make)\s+(un[oa]?\s+)?(immagin[ei]|image|foto|picture|illustration|illustrazione)\s*(di|of|about|su|per|con|:)?\s*/i,
      ''
    )
    .replace(/^(un[oa]?\s+)?(immagin[ei]|image|foto)\s*(di|of|about|su|per|:)?\s*/i, '')
    .trim();
  if (!s || s.length < 3) s = String(prompt || '').trim();
  // Limite prompt
  return s.slice(0, 500);
}

export async function generateImage(prompt, opts = {}) {
  const env = opts.env || {};
  const lang = opts.lang || 'it';
  const subject = extractImagePrompt(prompt);
  const fullPrompt =
    subject +
    ', high quality, detailed, cinematic lighting, digital art';

  // 1) Workers AI
  if (env.AI) {
    try {
      const models = [
        '@cf/black-forest-labs/flux-1-schnell',
        '@cf/stabilityai/stable-diffusion-xl-base-1.0',
        '@cf/lykon/dreamshaper-8-lcm',
      ];
      for (const model of models) {
        try {
          const res = await env.AI.run(model, {
            prompt: fullPrompt,
            num_steps: model.includes('flux') ? 4 : 20,
          });
          // Workers AI returns readable stream or ArrayBuffer
          let bytes;
          if (res instanceof ReadableStream) {
            const ab = await new Response(res).arrayBuffer();
            bytes = new Uint8Array(ab);
          } else if (res instanceof ArrayBuffer) {
            bytes = new Uint8Array(res);
          } else if (res && res.image) {
            bytes = Uint8Array.from(atob(res.image), (c) => c.charCodeAt(0));
          }
          if (bytes && bytes.length > 100) {
            const b64 = btoa(String.fromCharCode(...bytes.slice(0, bytes.length)));
            // chunk-safe base64 for large images
            const dataUrl = arrayBufferToDataUrl(bytes, 'image/png');
            return {
              ok: true,
              provider: 'workers-ai',
              model,
              prompt: subject,
              imageUrl: dataUrl,
              message: msgOk(lang, subject),
            };
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      /* fallback */
    }
  }

  // 2) Pollinations (URL pubblica, nessun secret)
  const seed = Math.floor(Math.random() * 1e9);
  const url =
    'https://image.pollinations.ai/prompt/' +
    encodeURIComponent(fullPrompt) +
    '?width=1024&height=1024&nologo=true&seed=' +
    seed +
    '&enhance=true';

  return {
    ok: true,
    provider: 'pollinations',
    prompt: subject,
    imageUrl: url,
    message: msgOk(lang, subject),
  };
}

function arrayBufferToDataUrl(u8, mime) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  return 'data:' + mime + ';base64,' + btoa(binary);
}

function msgOk(lang, subject) {
  const L = {
    it: 'Immagine generata: ' + subject,
    en: 'Image generated: ' + subject,
    es: 'Imagen generada: ' + subject,
    fr: 'Image générée : ' + subject,
    de: 'Bild erzeugt: ' + subject,
  };
  return L[lang] || L.it;
}
