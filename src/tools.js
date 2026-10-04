/**
 * WidowBlue – Tool registry / function calling
 * Gli agenti possono invocare tool strutturati invece di solo testo.
 */

export const TOOL_DEFS = [
  {
    name: 'web_search',
    description: 'Ricerca web multi-provider su una query',
    parameters: { query: 'string', deep: 'boolean?' },
  },
  {
    name: 'standings_serie_a',
    description: 'Estrae o richiede la classifica Serie A aggiornata',
    parameters: {},
  },
  {
    name: 'translate',
    description: 'Traduce testo verso una lingua target',
    parameters: { text: 'string', to: 'string' },
  },
  {
    name: 'agent_route',
    description: 'Seleziona sottoinsieme di agenti per un compito',
    parameters: { query: 'string', allAgents: 'boolean?' },
  },
];

export function planTools(query) {
  const q = String(query || '').toLowerCase();
  const plan = [];

  if (/classifica|serie\s*a|capolista|punti|standings/i.test(q)) {
    plan.push({ name: 'standings_serie_a', args: {} });
    plan.push({ name: 'web_search', args: { query: 'classifica Serie A aggiornata oggi', deep: true } });
  } else if (/traduci|translate|in inglese|in italian|in francese/i.test(q)) {
    const to = /inglese|english|\ben\b/i.test(q)
      ? 'en'
      : /francese|french/i.test(q)
        ? 'fr'
        : /tedesco|german/i.test(q)
          ? 'de'
          : 'it';
    plan.push({ name: 'translate', args: { text: query, to } });
  } else {
    plan.push({ name: 'web_search', args: { query: String(query || '').slice(0, 400), deep: true } });
  }

  plan.push({ name: 'agent_route', args: { query: String(query || '').slice(0, 400) } });
  return plan;
}

export async function runTools(plan, ctx = {}) {
  const results = [];
  for (const step of plan || []) {
    const name = step.name;
    const args = step.args || {};
    if (name === 'agent_route' && ctx.selectAgents) {
      const sel = ctx.selectAgents({ query: args.query, allMode: !!args.allAgents });
      results.push({
        tool: name,
        ok: true,
        data: { count: sel.count, intent: sel.intent, domains: sel.domains },
      });
    } else if (name === 'standings_serie_a') {
      results.push({
        tool: name,
        ok: true,
        data: { hint: 'classifica Serie A aggiornata oggi', needsSearch: true },
      });
    } else if (name === 'translate' && ctx.translate) {
      try {
        const out = await ctx.translate(args.text, 'auto', args.to || 'it');
        results.push({ tool: name, ok: true, data: { text: out } });
      } catch (e) {
        results.push({ tool: name, ok: false, error: String(e && e.message) });
      }
    } else if (name === 'web_search') {
      results.push({
        tool: name,
        ok: true,
        data: { query: args.query, deep: !!args.deep, deferred: true },
      });
    } else {
      results.push({ tool: name, ok: false, error: 'unknown_or_unbound_tool' });
    }
  }
  return results;
}

export function toolsCatalog() {
  return TOOL_DEFS.slice();
}
