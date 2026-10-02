/* WidowBlue – Glossario AI in-app */
(function () {
  const TERMS = [
    {
      id: 'addestramento',
      name: 'Addestramento',
      body: 'Processo in cui un modello regola i parametri sui dati per ridurre l\'errore. In WidowBlue non addestriamo modelli sul Worker: usiamo ricerca, RAG e sintesi grounded.',
    },
    {
      id: 'agi',
      name: 'AGI',
      body: 'Artificial General Intelligence: AI con capacità generali simili a quelle umane su molti compiti. Concetto di riferimento; i sistemi attuali (incluso WidowBlue) sono AI specializzata.',
    },
    {
      id: 'agente',
      name: 'Agente AI',
      body: 'Sistema che persegue un obiettivo, pianifica e usa strumenti. In WidowBlue i 453 agenti sono specializzati (ricerca, codice, ML, immagini…) e vengono selezionati in base alla richiesta.',
    },
    {
      id: 'gen',
      name: 'AI generativa',
      body: 'AI che crea contenuti nuovi (testo, immagini, codice). Qui: risposte generate dalle fonti web + eventuale generazione immagini se configurata.',
    },
    {
      id: 'hall',
      name: 'Allucinazione',
      body: 'Risposta plausible ma non supportata dai fatti. WidowBlue la riduce con retrieval multi-provider, ranking e sintesi solo dalle fonti (grounding).',
    },
    {
      id: 'bias',
      name: 'Bias',
      body: 'Distorsione sistematica nei dati o nelle risposte. Si mitiga con fonti diverse, verifica e linguaggio neutrale nelle risposte.',
    },
    {
      id: 'cot',
      name: 'Chain of thought',
      body: 'Ragionamento a passi interni prima della risposta finale. In WidowBlue i passi restano interni: in chat vedi solo la conclusione chiara.',
    },
    {
      id: 'dataset',
      name: 'Dataset',
      body: 'Insieme di esempi per train/val/test. Non usiamo dataset di training sul Worker; le “fonti” sono risultati web e contesto chat.',
    },
    {
      id: 'dl',
      name: 'Deep learning',
      body: 'Reti neurali multi-strato. Concetto di riferimento per capire LLM e vision; l\'app non esegue training deep learning in edge.',
    },
    {
      id: 'distill',
      name: 'Distillazione',
      body: 'Trasferimento di conoscenza da un modello grande a uno più piccolo. Non implementata come pipeline di training (poco utile sul Worker).',
    },
    {
      id: 'ft',
      name: 'Fine-tuning',
      body: 'Adattamento di un modello pre-addestrato a un compito. Non eseguito sul Worker; miglioriamo invece prompt, retrieval e routing agenti.',
    },
    {
      id: 'llm',
      name: 'LLM',
      body: 'Large Language Model: modello linguistico di grandi dimensioni. Può essere collegato via Workers AI / provider; la chat usa anche sintesi deterministica dalle fonti.',
    },
    {
      id: 'ml',
      name: 'Machine learning',
      body: 'Apprendimento da dati senza regole scritte a mano per ogni caso. In app: ranking fonti, intent, contesto conversazione e routing multi-agente.',
    },
    {
      id: 'pretrain',
      name: 'Pre-training',
      body: 'Fase di apprendimento generico su grandi corpus. Non implementata localmente; i modelli esterni (se collegati) arrivano già pre-addestrati.',
    },
    {
      id: 'prompt',
      name: 'Prompt engineering',
      body: 'Progettazione di istruzioni per risposte migliori. Attivo in WidowBlue nei prompt di sistema RAG (lingua, grounding, anti-meta).',
    },
    {
      id: 'nn',
      name: 'Rete neurale',
      body: 'Modello a strati di unità collegate da pesi. Concetto teorico; la visualizzazione a nodi della UI è una metafora della rete di agenti.',
    },
    {
      id: 'asi',
      name: 'Superintelligenza artificiale',
      body: 'Ipotetica AI oltre le capacità umane nella maggior parte dei domini. Non è una funzione implementabile: solo termine di glossario.',
    },
    {
      id: 'token',
      name: 'Token',
      body: 'Unità base del testo per i modelli linguistici. Influenza lunghezza contesto e costi; le risposte in chat sono limitate in lunghezza per leggibilità.',
    },
  ];

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>');
  }

  function openGlossary() {
    const ov = document.getElementById('glossOverlay');
    const pan = document.getElementById('glossPanel');
    const body = document.getElementById('glossBody');
    if (!ov || !pan || !body) return;
    body.innerHTML = TERMS.map(
      (t) =>
        '<article class="gloss-item" data-id="' +
        esc(t.id) +
        '"><h4>' +
        esc(t.name) +
        '</h4><p>' +
        esc(t.body) +
        '</p></article>'
    ).join('');
    ov.classList.add('open');
    pan.classList.add('open');
    ov.setAttribute('aria-hidden', 'false');
    pan.setAttribute('aria-hidden', 'false');
  }

  function closeGlossary() {
    const ov = document.getElementById('glossOverlay');
    const pan = document.getElementById('glossPanel');
    if (ov) {
      ov.classList.remove('open');
      ov.setAttribute('aria-hidden', 'true');
    }
    if (pan) {
      pan.classList.remove('open');
      pan.setAttribute('aria-hidden', 'true');
    }
  }

  function init() {
    const btn = document.getElementById('glossaryBtn');
    const close = document.getElementById('glossClose');
    const ov = document.getElementById('glossOverlay');
    if (btn) btn.addEventListener('click', openGlossary);
    if (close) close.addEventListener('click', closeGlossary);
    if (ov) ov.addEventListener('click', closeGlossary);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeGlossary();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.WBGlossary = { TERMS, open: openGlossary, close: closeGlossary };
})();
