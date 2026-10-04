/**
 * WidowBlue – gestione lingue
 * Priorità ASSOLUTA: lingua UI selezionata → poi rilevamento testo.
 * Risposte sempre nella lingua scelta (it…pl e altre supportate).
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

export const SUPPORTED_LANGS = Object.keys(LANG_NAMES);

export function langName(code) {
  const c = String(code || 'it').slice(0, 2).toLowerCase();
  return LANG_NAMES[c] || LANG_NAMES.it;
}

export function normalizeLang(code) {
  let c = String(code || '').toLowerCase().trim();
  if (c.includes('-')) c = c.split('-')[0];
  if (c === 'auto' || !c) return 'auto';
  if (LANG_NAMES[c]) return c;
  return 'auto';
}

export function detectLang(text) {
  const t = String(text || '');
  if (!t.trim()) return 'it';

  if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(t)) return 'ja';
  if (/[\u4e00-\u9fff]/.test(t) && !/[\u3040-\u30ff]/.test(t)) return 'zh';
  if (/[\uac00-\ud7af]/.test(t)) return 'ko';
  if (/[\u0600-\u06ff]/.test(t)) return 'ar';
  if (/[\u0900-\u097f]/.test(t)) return 'hi';
  if (/[\u0400-\u04ff]/.test(t)) {
    if (/[іїєґІЇЄҐ]/.test(t) || /\b(що|як|це|або|буде|також)\b/i.test(t)) return 'uk';
    return 'ru';
  }

  const scores = { it: 0, en: 0, es: 0, fr: 0, de: 0, pt: 0, pl: 0, nl: 0, tr: 0 };

  if (/[àèéìòù]/i.test(t)) scores.it += 3;
  if (/[ñ¿¡]/i.test(t)) scores.es += 3;
  if (/[àâçéèêëîïôùûüœ]/i.test(t)) scores.fr += 2;
  if (/[äöüß]/i.test(t)) scores.de += 3;
  if (/[ąćęłńóśźż]/i.test(t)) scores.pl += 4;
  if (/[ãõáéíóúâêôç]/i.test(t)) scores.pt += 2;

  const rules = [
    ['it', /\b(il|la|di|del|della|che|cosa|quando|dove|perché|perche|come|chi|ciao|grazie|sono|con|per|una|questo|questa|classifica|punti|primo|degli|delle|agli|nelle|risposta|domanda)\b/gi],
    ['en', /\b(the|and|with|from|what|when|where|who|why|how|is|are|this|that|points|standings|followed|please|because|which|would|could|should)\b/gi],
    ['es', /\b(qué|cuando|dónde|quién|porque|hola|está|también|como|pero|para|una|los|las|del|respuesta)\b/gi],
    ['fr', /\b(quoi|quand|où|pourquoi|bonjour|avec|pour|une|les|des|est|sont|réponse|comment)\b/gi],
    ['de', /\b(was|wann|wie|wer|warum|nicht|und|der|die|das|ist|sind|eine|auf|für|antwort)\b/gi],
    ['pt', /\b(o que|quando|onde|porque|obrigado|também|como|para|uma|não|resposta|você)\b/gi],
    ['pl', /\b(co|jak|gdzie|kiedy|dlaczego|jest|nie|tak|czy|oraz|odpowiedź|pytanie|proszę|dzień|dobry)\b/gi],
    ['nl', /\b(wat|hoe|waar|wanneer|waarom|niet|een|het|de|is|zijn|voor|antwoord|vraag)\b/gi],
    ['tr', /\b(ne|ve|bir|için|nedir|nasıl|neden|var|yok|lütfen|cevap|soru)\b/gi],
  ];
  for (const [code, re] of rules) {
    const m = t.match(re);
    if (m) scores[code] = (scores[code] || 0) + m.length;
  }

  let best = 'it';
  let bestScore = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestScore) {
      bestScore = v;
      best = k;
    }
  }
  if (bestScore <= 0) return 'it';
  return best;
}

export function resolveLang(body, prompt) {
  const raw = normalizeLang((body && body.lang) || 'auto');
  if (raw !== 'auto' && LANG_NAMES[raw]) return raw;
  return detectLang(prompt);
}

export function noAnswerMsg(lang) {
  const map = {
    it: 'Non ho trovato una risposta chiara e aggiornata nelle fonti disponibili. Prova a riformulare la domanda o a specificare meglio il contesto.',
    en: 'I could not find a clear, up-to-date answer from the available sources. Try rephrasing or adding more context.',
    es: 'No encontré una respuesta clara y actualizada en las fuentes disponibles. Intenta reformular la pregunta.',
    fr: "Je n'ai pas trouvé de réponse claire et à jour dans les sources disponibles. Essayez de reformuler.",
    de: 'In den verfügbaren Quellen konnte ich keine klare, aktuelle Antwort finden. Bitte formulieren Sie die Frage um.',
    pt: 'Não encontrei uma resposta clara e atualizada nas fontes disponíveis. Tente reformular a pergunta.',
    pl: 'Nie znalazłem jasnej i aktualnej odpowiedzi w dostępnych źródłach. Spróbuj przeformułować pytanie.',
    nl: 'Ik kon geen duidelijk en actueel antwoord vinden in de beschikbare bronnen. Probeer de vraag te herformuleren.',
    tr: 'Mevcut kaynaklarda net ve güncel bir yanıt bulamadım. Lütfen soruyu yeniden ifade edin.',
    ja: '利用可能な情報源から明確で最新の回答を見つけられませんでした。質問を言い換えてみてください。',
    zh: '在可用来源中未找到清晰且最新的答案。请尝试换一种方式提问。',
    ko: '사용 가능한 출처에서 명확하고 최신의 답변을 찾지 못했습니다. 질문을 다시 작성해 보세요.',
    ar: 'لم أجد إجابة واضحة ومحدثة في المصادر المتاحة. حاول إعادة صياغة السؤال.',
    ru: 'Не удалось найти ясный и актуальный ответ в доступных источниках. Попробуйте переформулировать вопрос.',
    hi: 'उपलब्ध स्रोतों में स्पष्ट और अद्यतन उत्तर नहीं मिला। कृपया प्रश्न को दोबारा लिखें।',
    uk: 'Не вдалося знайти чіткої та актуальної відповіді в доступних джерелах. Спробуйте переформулювати питання.',
  };
  const c = String(lang || 'it').slice(0, 2);
  return map[c] || map.en;
}

export async function translateText(text, from, to) {
  const q = String(text || '').trim().slice(0, 480);
  if (!q) return '';
  let f = String(from || 'autodetect').slice(0, 5).toLowerCase();
  const t = String(to || 'en').slice(0, 2).toLowerCase();
  if (f === 'auto') f = 'autodetect';
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
    const out = (data && data.responseData && data.responseData.translatedText) || '';
    if (!out || /INVALID|QUERY LENGTH|MYMEMORY WARNING/i.test(out)) return q;
    return String(out).trim();
  } catch (_) {
    return q;
  }
}

export async function forceLang(text, targetLang) {
  const t = String(text || '').trim();
  if (!t || t.length < 4) return t;
  const target = normalizeLang(targetLang);
  if (target === 'auto' || !LANG_NAMES[target]) return t;

  const detected = detectLang(t);
  if (detected === target && looksMostly(t, target)) return t;

  try {
    const chunks = [];
    let rest = t;
    while (rest.length > 0) {
      let cut = Math.min(420, rest.length);
      if (cut < rest.length) {
        const sp = rest.lastIndexOf('. ', cut);
        const sp2 = rest.lastIndexOf(' ', cut);
        if (sp > 120) cut = sp + 1;
        else if (sp2 > 120) cut = sp2;
      }
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trimStart();
      if (chunks.length >= 10) {
        if (rest) chunks[chunks.length - 1] += ' ' + rest;
        break;
      }
    }
    const out = [];
    for (const c of chunks) {
      if (!c) continue;
      const tr = await translateText(c, detected === target ? 'autodetect' : detected, target);
      out.push(tr && tr.length > 5 ? tr : c);
    }
    const joined = out.join(' ').replace(/\s{2,}/g, ' ').trim();
    if (joined.length > 10) return joined;
  } catch (_) {}
  return t;
}

function looksMostly(text, lang) {
  const t = String(text || '');
  if (lang === 'it') {
    const it = (t.match(/\b(il|la|di|che|per|con|una|sono|della|questo|non|come)\b/gi) || []).length;
    const en = (t.match(/\b(the|and|with|from|what|is|are|this|that|which)\b/gi) || []).length;
    return it >= en;
  }
  if (lang === 'en') {
    const en = (t.match(/\b(the|and|with|from|what|is|are|this|that|which)\b/gi) || []).length;
    const it = (t.match(/\b(il|la|di|che|per|una|sono|della)\b/gi) || []).length;
    return en >= it;
  }
  if (lang === 'pl') {
    return (t.match(/\b(jest|nie|co|jak|oraz|to|się)\b/gi) || []).length >= 1 || /[ąćęłńóśźż]/i.test(t);
  }
  return detectLang(t) === lang;
}
