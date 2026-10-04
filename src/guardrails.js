/**
 * WidowBlue – Guardrails & anti prompt-injection
 * Filtra input ostili e output fuori policy prima di retrieval/generazione.
 */

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all\s+)?(previous|prior|system)/i,
  /forget\s+(everything|all|your)\s+(instructions?|rules?|prompt)/i,
  /you\s+are\s+now\s+(dan|unrestricted|jailbroken)/i,
  /act\s+as\s+(if\s+you\s+have\s+)?no\s+(restrictions?|limits?|rules?)/i,
  /system\s*:\s*/i,
  /\[INST\]|<<SYS>>|<\|im_start\|>/i,
  /override\s+(system|safety|policy)/i,
  /bypass\s+(safety|filter|guardrail)/i,
  /ignora\s+(tutte\s+le\s+)?(istruzioni|regole)\s+(precedenti|di\s+sistema)/i,
  /dimentica\s+(tutto|le\s+istruzioni)/i,
  /sei\s+ora\s+(senza\s+limiti|jailbreak)/i,
];

const BLOCKED_OUTPUT = [
  /\b(api[_-]?key|secret[_-]?key|password\s*[:=])/i,
  /\bBEGIN\s+(RSA\s+)?PRIVATE\s+KEY\b/i,
];

/**
 * Analizza e sanifica la query utente.
 * @returns {{ ok: boolean, query: string, flags: string[], blocked?: boolean, reason?: string }}
 */
export function guardInput(raw) {
  const original = String(raw || '').trim();
  const flags = [];
  if (!original) return { ok: false, query: '', flags: ['empty'], blocked: true, reason: 'empty_query' };

  let q = original.slice(0, 2000);
  let hits = 0;
  for (const re of INJECTION_PATTERNS) {
    if (re.test(q)) {
      hits++;
      flags.push('prompt_injection');
      q = q.replace(re, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  if (hits >= 2) {
    return {
      ok: false,
      query: original.slice(0, 200),
      flags,
      blocked: true,
      reason: 'prompt_injection',
    };
  }

  q = q.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  return { ok: true, query: q || original.slice(0, 400), flags, blocked: false };
}

/**
 * Filtra output generato (segreti, leakage di system prompt).
 */
export function guardOutput(text) {
  let t = String(text || '');
  const flags = [];
  for (const re of BLOCKED_OUTPUT) {
    if (re.test(t)) {
      flags.push('secret_leak');
      t = t.replace(re, '[redacted]');
    }
  }
  t = t.replace(/system prompt[:\s].{0,200}/gi, '');
  t = t.replace(/\b(as an ai language model|come modello di linguaggio)\b/gi, '');
  return { text: t.trim(), flags };
}

export function guardrailPolicy() {
  return {
    promptInjectionFilter: true,
    outputRedaction: true,
    maxInputChars: 2000,
    standard: 'nis2-aligned-minimal',
  };
}
