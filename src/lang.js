/**
 * WidowBlue – gestione lingue
 * lang selezionato ha priorità; auto = rilevamento dal testo.
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

/** Rileva lingua approssimativa del testo utente */
export function detectLang(text) {
  const t = String(text || '');
  if (!t.trim()) return 'it';
  if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(t)) return 'ja'; // hiragana/katakana
  if (/[\u4e00-\u9fff]/.test(t) && !/[\u3040-\u30ff]/.test(t)) return 'zh';
  if (/[\uac00-\ud7af]/.test(t)) return 'ko';
  if (/[\u0600-\u06ff]/.test(t)) return 'ar';
  if (/[\u0400-\u04ff]/.test(t)) return 'ru';
  if (/[\u0900-\u097f]/.test(t)) return 'hi';
  if (/[äöüß]/i.test(t) || /\b(was|wann|wie|wer|warum|nicht|und)\b/i.test(t)) return 'de';
  if (/[ñ¿¡]/i.test(t) || /\b(qué|cuando|dónde|quién|porque|hola)\b/i.test(t)) return 'es';
  if (/[àâçéèêëîïôùûü]/i.test(t) || /\b(quoi|quand|où|pourquoi|bonjour)\b/i.test(t)) return 'fr';
  if (/\b(o que|quando|onde|porque|obrigado)\b/i.test(t)) return 'pt';
  if (/[àèéìòù]/i.test(t) || /\b(che|cosa|quando|dove|perché|perche|come|chi|ciao|grazie)\b/i.test(t))
    return 'it';
  if (/\b(what|when|where|who|why|how|the|and|please)\b/i.test(t)) return 'en';
  return 'en';
}

/**
 * Risolve lingua effettiva.
 * body.lang = selezione UI ('auto' | codice).
 */
export function resolveLang(body, prompt) {
  let lang = String((body && body.lang) || 'auto').toLowerCase();
  if (lang.includes('-')) lang = lang.split('-')[0];
  if (!lang || lang === 'auto') return detectLang(prompt);
  if (LANG_NAMES[lang]) return lang;
  return detectLang(prompt);
}

/** Messaggi fallback multilinguа */
export function noAnswerMsg(lang) {
  const map = {
    it: 'Non ho trovato una risposta chiara e aggiornata nelle fonti disponibili.',
    en: 'I could not find a clear, up-to-date answer from the available sources.',
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

/**
 * Traduzione leggera via MyMemory (senza chiave, rate-limit).
 * Usata quando UI force-lang ≠ lingua del testo.
 */
export async function translateText(text, from, to) {
  const q = String(text || '').trim().slice(0, 450);
  if (!q) return '';
  const f = (from || 'autodetect').slice(0, 5);
  const t = String(to || 'en').slice(0, 2);
  if (f === t) return q;
  try {
    const url =
      'https://api.mymemory.translated.net/get?q=' +
      encodeURIComponent(q) +
      '&langpair=' +
      encodeURIComponent(f + '|' + t);
    const res = await fetch(url, { cf: { cacheTtl: 3600 } });
    if (!res.ok) return q;
    const data = await res.json();
    const out =
      (data && data.responseData && data.responseData.translatedText) || '';
    if (!out || /INVALID|QUERY LENGTH|MYMEMORY WARNING/i.test(out)) return q;
    return String(out).trim();
  } catch (_) {
    return q;
  }
}
