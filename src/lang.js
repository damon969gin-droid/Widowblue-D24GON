/**
 * WidowBlue – gestione lingue
 * Priorità: lingua UI selezionata → rilevamento testo → fallback.
 * Traduzione on-the-fly quando UI lang ≠ lingua input/output.
 */

export const LANG_NAMES = {
  it: 'italiano',
  en: 'English',
  es: 'español',
  fr: 'français',
  de: 'Deutsch',
  pt: 'português',
  ja: '日本語',
  zh: '中文',
  ko: '한국어',
  ar: 'العربية',
  ru: 'русский',
  hi: 'हिन्दी',
  tr: 'Türkçe',
  nl: 'Nederlands',
  pl: 'polski',
  uk: 'українська',
};

export function langName(code) {
  const c = String(code || 'it').slice(0, 2).toLowerCase();
  return LANG_NAMES[c] || LANG_NAMES.it;
}

export function detectLang(text) {
  const t = String(text || '');
  if (!t.trim()) return 'it';
  if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(t)) return 'ja';
  if (/[\u4e00-\u9fff]/.test(t) && !/[\u3040-\u30ff]/.test(t)) return 'zh';
  if (/[\uac00-\ud7af]/.test(t)) return 'ko';
  if (/[\u0600-\u06ff]/.test(t)) return 'ar';
  if (/[\u0400-\u04ff]/.test(t)) return 'ru';
  if (/[\u0900-\u097f]/.test(t)) return 'hi';
  if (/[äöüß]/i.test(t) || /\b(was|wann|wie|wer|warum|nicht|und|der|die|das)\b/i.test(t)) return 'de';
  if (/[ñ¿¡]/i.test(t) || /\b(qué|cuando|dónde|quién|porque|hola|está|también)\b/i.test(t)) return 'es';
  if (/[àâçéèêëîïôùûü]/i.test(t) || /\b(quoi|quand|où|pourquoi|bonjour|est|avec)\b/i.test(t)) return 'fr';
  if (/\b(o que|quando|onde|porque|obrigado|também)\b/i.test(t)) return 'pt';
  const itHits = (t.match(/\b(il|la|di|del|della|che|cosa|quando|dove|perché|perche|come|chi|ciao|grazie|sono|è|con|per|una|questo|questa|classifica|punti|primo)\b/gi) || []).length;
  const enHits = (t.match(/\b(the|and|with|from|what|when|where|who|why|how|is|are|this|that|points|standings|followed)\b/gi) || []).length;
  if (/[àèéìòù]/i.test(t) || itHits >= 2) return 'it';
  if (enHits >= 2 || /\b(what|when|where|who|why|how|the|and|please)\b/i.test(t)) return 'en';
  if (itHits >= enHits) return 'it';
  // default italiano (prodotto IT-first)
  return 'it';
}

export function resolveLang(body, prompt) {
  let lang = String((body && body.lang) || 'auto').toLowerCase();
  if (lang.includes('-')) lang = lang.split('-')[0];
  if (!lang || lang === 'auto') return detectLang(prompt);
  if (LANG_NAMES[lang]) return lang;
  return detectLang(prompt);
}

export function noAnswerMsg(lang) {
  const map = {
    it: 'Non ho trovato una risposta chiara e aggiornata nelle fonti disponibili. Prova a riformulare la domanda o a specificare meglio il contesto.',
    en: 'I could not find a clear, up-to-date answer from the available sources. Try rephrasing or adding more context.',
    es: 'No encontré una respuesta clara y actualizada en las fuentes disponibles.',
    fr: "Je n'ai pas trouvé de réponse claire et à jour dans les sources disponibles.",
    de: 'In den verfügbaren Quellen konnte ich keine klare, aktuelle Antwort finden.',
    pt: 'Não encontrei uma resposta clara e atualizada nas fontes disponíveis.',
    ja: '利用可能な情報源から、明確で最新の回答は見つかりませんでした。',
    zh: '未能从可用来源中找到清晰、最新的答案。',
    ko: '사용 가능한 출처에서 명확하고 최신 답변을 찾지 못했습니다.',
    ar: 'لم أجد إجابة واضحة ومحدثة من المصادر المتاحة.',
    ru: 'Не удалось найти ясный и актуальный ответ в доступных источниках.',
  };
  return map[lang] || map.en;
}

export async function translateText(text, from, to) {
  const q = String(text || '').trim().slice(0, 480);
  if (!q) return '';
  const f = (from || 'autodetect').slice(0, 5);
  const t = String(to || 'en').slice(0, 2);
  if (f === t || (f === 'auto' && !to)) return q;
  try {
    const url =
      'https://api.mymemory.translated.net/get?q=' +
      encodeURIComponent(q) +
      '&langpair=' +
      encodeURIComponent((f === 'auto' || f === 'autodetect' ? 'autodetect' : f) + '|' + t);
    const res = await fetch(url, { cf: { cacheTtl: 3600 } });
    if (!res.ok) return q;
    const data = await res.json();
    const out = (data && data.responseData && data.responseData.translatedText) || '';
    if (!out || /INVALID|QUERY LENGTH|MYMEMORY WARNING/i.test(out)) return q;
    return String(out).trim();
  } catch (_) {
    return q;
  }
}

export async function forceLang(text, targetLang) {
  const t = String(text || '').trim();
  if (!t || t.length < 8) return t;
  const target = String(targetLang || 'it').slice(0, 2);
  const detected = detectLang(t);
  if (detected === target) return t;
  // traduci a blocchi (MyMemory max ~500 char)
  try {
    const chunks = [];
    let rest = t;
    while (rest.length > 0) {
      let cut = Math.min(450, rest.length);
      if (cut < rest.length) {
        const sp = rest.lastIndexOf(' ', cut);
        if (sp > 200) cut = sp;
      }
      chunks.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
      if (chunks.length >= 8) {
        chunks[chunks.length - 1] += (rest ? ' ' + rest : '');
        break;
      }
    }
    const out = [];
    for (const c of chunks) {
      const tr = await translateText(c, detected, target);
      out.push(tr && tr.length > 10 ? tr : c);
    }
    const joined = out.join(' ').replace(/\s+/g, ' ').trim();
    if (joined.length > 20) return joined;
  } catch (_) {}
  return t;
}
