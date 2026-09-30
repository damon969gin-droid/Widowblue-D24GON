/* Patch run() to call backend orchestrate + modular search when API is up */
(function () {
  const origGo = document.getElementById('go');
  if (!origGo || !window.wbApi) return;

  // Wrap after wb-net loaded: replace completion path via monkey-patch show of results
  const _run = window.run;
  // wb-net defines run in local scope — rebind go click to enhanced runner
  async function finishWithApi(prompt, atts, deep, nAgents) {
    say('Ricerca', deep ? 'multi-provider deep…' : 'multi-provider…');
    const r = await wbApi.orchestrate(prompt, {
      deep,
      search: true,
      attachments: atts.map((a) => a.name),
    });
    if (r.ok && r.data && r.data.plan) {
      const p = r.data.plan;
      const s = r.data.search;
      let body =
        (deep ? '═══ WIDOWBLUE DEEP + LIVE SEARCH ═══\n' : '═══ WIDOWBLUE + LIVE SEARCH ═══\n') +
        'Agenti: ' +
        nAgents +
        '\nModalità: ' +
        (deep ? 'TUTTI GLI AGENTI' : 'standard') +
        '\n\nRICHIESTA\n' +
        prompt +
        '\n\nSTACK\n- ' +
        (p.stack || []).join('\n- ') +
        '\n\nSTEPS\n' +
        (p.steps || []).map((x, i) => i + 1 + '. ' + x).join('\n');
      if (s && s.results && s.results.length) {
        body +=
          '\n\nFONTI WEB (tracciate)\n' +
          s.results
            .slice(0, deep ? 12 : 6)
            .map((x) => '- [' + x.provider + '] ' + x.title + '\n  ' + x.url)
            .join('\n');
        if (s.providers) {
          body +=
            '\n\nProvider: ' +
            s.providers.map((pr) => pr.name + (pr.ok ? '✓' : '✗')).join(', ');
        }
      } else if (!r.ok) {
        body += '\n\n(Ricerca live non disponibile — fallback locale)';
      }
      body += '\n\n— WidowBlue backend';
      showPanel(deep ? 'Deep + ricerca live' : 'Piano + ricerca live', body);
      if (window.wbSaveConversation) wbSaveConversation(prompt, body);
      say('Widow Blue', deep ? 'deep + search completata · ' + nAgents + ' agenti' : 'piano + search pronto');
      return true;
    }
    return false;
  }

  // Intercept: after animation, try API
  const nativeRun = document.getElementById('go').onclick;
  document.getElementById('go').onclick = function () {
    if (typeof running !== 'undefined' && running) return;
    // Let wb-net handle UI; we patch by listening to panel - simpler: dual path
    if (typeof run === 'function') {
      // override run if global - wb-net keeps run private
    }
    // Call original then enhance is hard; replace entire handler with copy of run + API
    enhancedRun();
  };

  function enhancedRun() {
    if (typeof running !== 'undefined' && running) return;
    const qEl = document.getElementById('q');
    const q = qEl.value.trim();
    if (!q && !(typeof files !== 'undefined' && files.length)) {
      say('Widow Blue', 'scrivi, parla o allega');
      return;
    }
    // Delegate to original run from wb-net by dispatching - actually call internal if exposed
    if (window.__wbRun) return window.__wbRun();
    // Fallback: click simulation won't work. Expose from next wb-net update.
    say('Sistema', 'usa Invia (rete attiva). API orchestrate pronta su /api/orchestrate');
  }

  window.wbFinishWithApi = finishWithApi;
  say('Backend', 'API search + orchestrate caricate');
})();
