/* WidowBlue – Glossario AI in-app (termini tecnici completi) */
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
      body: 'Insieme di esempi per train/val/test. Non usiamo dataset di training sul Worker; le fonti sono risultati web e contesto chat.',
    },
    {
      id: 'dl',
      name: 'Deep learning',
      body: 'Reti neurali multi-strato. Concetto di riferimento per capire LLM e vision; l\'app non esegue training deep learning in edge.',
    },
    {
      id: 'ft',
      name: 'Fine-tuning',
      body: 'Adattamento di un modello pre-addestrato a un compito. Non eseguito sul Worker; miglioriamo invece prompt, retrieval e routing agenti.',
    },
    {
      id: 'grounding',
      name: 'Grounding',
      body: 'Ancorare le risposte a fonti verificabili. In WidowBlue ogni sintesi parte dai risultati di ricerca multi-provider.',
    },
    {
      id: 'llm',
      name: 'LLM',
      body: 'Large Language Model: modello linguistico di grandi dimensioni (tipicamente Transformer) addestrato su testi massivi.',
    },
    {
      id: 'prompt',
      name: 'Prompt',
      body: 'Istruzione o domanda inviata al modello. La qualità del prompt influenza molto la risposta.',
    },
    {
      id: 'rag_base',
      name: 'RAG (base)',
      body: 'Retrieval-Augmented Generation: recupera documenti e li usa come contesto. È il cuore di WidowBlue.',
    },
    {
      id: 'token',
      name: 'Token',
      body: 'Unità di testo processata dal modello (parola o sotto-parola). Conta per limiti di contesto e costi.',
    },
    {
      id: 'embedding_base',
      name: 'Embedding (base)',
      body: 'Vettore numerico che rappresenta testo o altri dati in uno spazio dove la similarità semantica corrisponde alla prossimità.',
    },
    {
      id: 'worker',
      name: 'Worker / Edge',
      body: 'Runtime serverless (es. Cloudflare Workers) vicino all\'utente. WidowBlue gira in edge con ricerca e sintesi grounded.',
    },
    {
      id: 'nis2',
      name: 'NIS2 / Sicurezza',
      body: 'Direttiva UE sulla cybersecurity. WidowBlue punta a pratiche allineate: minimi dati, chiavi temporizzate, niente training su chat utente.',
    },
    {
      id: 'transformer',
      name: 'Transformer',
      body: 'Architettura base dei LLM moderni basata su self-attention. Consente di modellare relazioni a lungo raggio nel testo senza reti ricorrenti pure.',
    },
    {
      id: 'attention',
      name: 'Self-Attention / Multi-Head Attention',
      body: 'Meccanismo che pesa le relazioni tra token. Multi-head = più teste in parallelo che catturano pattern diversi (sintassi, semantica, riferimenti).',
    },
    {
      id: 'rope',
      name: 'RoPE / Positional Encoding',
      body: 'Codifica della posizione dei token. RoPE (Rotary Positional Embeddings) ruota le rappresentazioni nello spazio latente per gestire meglio contesti lunghi.',
    },
    {
      id: 'moe',
      name: 'Mixture of Experts (MoE)',
      body: 'Architettura in cui solo un sottoinsieme di esperti (sottoreti) si attiva per ogni input: più capacità a costo di calcolo selettivo.',
    },
    {
      id: 'flashattn',
      name: 'Flash Attention',
      body: 'Implementazione ottimizzata dell\'attention che riduce accessi alla memoria GPU e accelera training e inference su sequenze lunghe.',
    },
    {
      id: 'residual',
      name: 'Residual Connections / LayerNorm / RMSNorm',
      body: 'Scorciatoie residuali e normalizzazioni di layer che stabilizzano l\'addestramento di reti profonde. RMSNorm è una variante più efficiente.',
    },
    {
      id: 'ssm',
      name: 'SSM / Mamba',
      body: 'State Space Models: alternative ai Transformer per sequenze lunghe, con complessità quasi lineare. Mamba è una famiglia recente di modelli SSM.',
    },
    {
      id: 'diffusion',
      name: 'Diffusion / VAE / GAN',
      body: 'Famiglie generative: diffusion (rumore→immagine/testo), VAE (latente probabilistico), GAN (generatore vs discriminatore).',
    },
    {
      id: 'ctxwindow',
      name: 'Context Window',
      body: 'Numero massimo di token che il modello può considerare in una volta (prompt + risposta). Limite pratico di memoria del modello.',
    },
    {
      id: 'kvcache',
      name: 'KV Cache',
      body: 'Cache di chiavi/valori dell\'attention già calcolati: accelera la generazione token-per-token evitando ricalcoli.',
    },
    {
      id: 'pretrain',
      name: 'Pretraining / Fine-tuning',
      body: 'Pretraining: apprendimento generale su grandi corpora. Fine-tuning: adattamento a un compito o dominio specifico.',
    },
    {
      id: 'rlhf',
      name: 'RLHF',
      body: 'Reinforcement Learning from Human Feedback: allinea il modello alle preferenze umane tramite ricompense derivate da giudizi di valutatori.',
    },
    {
      id: 'dpo',
      name: 'DPO',
      body: 'Direct Preference Optimization: allinea il modello su coppie preferenza/rifiuto senza un reward model esplicito separato.',
    },
    {
      id: 'lora',
      name: 'LoRA / QLoRA / PEFT',
      body: 'Fine-tuning efficiente: si addestrano poche matrici low-rank (LoRA) o in quantizzazione (QLoRA) invece di tutti i pesi (PEFT).',
    },
    {
      id: 'gradckpt',
      name: 'Gradient Checkpointing / Clipping',
      body: 'Checkpointing: ricalcola attivazioni per risparmiare memoria. Clipping: limita la norma del gradiente per stabilizzare l\'ottimizzazione.',
    },
    {
      id: 'mixedprec',
      name: 'Mixed Precision (FP16/BF16/FP8)',
      body: 'Addestramento/inference a precisione ridotta per velocità e meno memoria, con accorgimenti per la stabilità numerica.',
    },
    {
      id: 'quant',
      name: 'Quantizzazione (INT8/INT4, GPTQ, AWQ, GGUF)',
      body: 'Riduzione della precisione dei pesi per diminuire memoria e latenza in inference (GPTQ, AWQ, formati GGUF).',
    },
    {
      id: 'distill',
      name: 'Knowledge Distillation',
      body: 'Trasferimento di conoscenza da un modello grande (teacher) a uno più piccolo (student).',
    },
    {
      id: 'scaling',
      name: 'Scaling Laws',
      body: 'Relazioni empiriche tra dimensione del modello, dati, compute e performance predette.',
    },
    {
      id: 'lrsched',
      name: 'Learning Rate Scheduler',
      body: 'Piani di learning rate (warmup, cosine decay, ecc.) che regolano quanto velocemente il modello aggiorna i pesi.',
    },
    {
      id: 'catastrophic',
      name: 'Catastrophic Forgetting',
      body: 'Perdita di conoscenze precedenti quando si fine-tuna su nuovi compiti senza tecniche di continuità.',
    },
    {
      id: 'gpu',
      name: 'GPU / TPU / Tensor Cores',
      body: 'Acceleratori hardware per training e inference. Tensor Cores (NVIDIA) ottimizzano matrici a bassa precisione; TPU sono ASIC Google.',
    },
    {
      id: 'disttrain',
      name: 'Distributed Training',
      body: 'Data / Tensor / Pipeline Parallelism: distribuire dati, layer o pipeline di layer su più dispositivi.',
    },
    {
      id: 'zero',
      name: 'ZeRO',
      body: 'Zero Redundancy Optimizer: partiziona stati dell\'ottimizzatore/gradenti/parametri tra GPU per ridurre memoria (DeepSpeed).',
    },
    {
      id: 'cuda',
      name: 'CUDA / cuDNN',
      body: 'Stack NVIDIA per calcolo parallelo su GPU (CUDA) e primitive di deep learning ottimizzate (cuDNN).',
    },
    {
      id: 'interconnect',
      name: 'NVLink / InfiniBand',
      body: 'Interconnessioni ad alta banda tra GPU (NVLink) o nodi cluster (InfiniBand) per training distribuito.',
    },
    {
      id: 'frameworks',
      name: 'PyTorch / TensorFlow / JAX / DeepSpeed / Megatron',
      body: 'Framework e librerie per definire, addestrare e scalare modelli neurali.',
    },
    {
      id: 'serving',
      name: 'Serving LLM (vLLM, TensorRT-LLM, Triton, ONNX)',
      body: 'Sistemi per servire modelli in produzione con alta throughput e bassa latenza (continuous batching, kernel ottimizzati).',
    },
    {
      id: 'k8s',
      name: 'Kubernetes / Docker / Terraform',
      body: 'Container (Docker), orchestrazione (Kubernetes) e infrastruttura come codice (Terraform) per deploy riproducibili.',
    },
    {
      id: 'contbatch',
      name: 'Continuous Batching',
      body: 'Tecnica di serving che inserisce nuove richieste nel batch in corso per massimizzare l\'uso GPU.',
    },
    {
      id: 'embedding',
      name: 'Embedding',
      body: 'Rappresentazione vettoriale di testo (o altri dati) in uno spazio numerico dove similarità semantica ≈ prossimità (es. cosine similarity).',
    },
    {
      id: 'vectordb',
      name: 'Vector Database',
      body: 'Database ottimizzato per ricerca per similarità su embedding (Pinecone, Milvus, Qdrant, Weaviate, FAISS, Chroma).',
    },
    {
      id: 'ann',
      name: 'ANN / HNSW / IVF',
      body: 'Approximate Nearest Neighbor: indici (HNSW, IVF) per trovare vettori simili in modo veloce su grandi collezioni.',
    },
    {
      id: 'rag',
      name: 'RAG',
      body: 'Retrieval-Augmented Generation: recupera documenti rilevanti e li usa come contesto per generare risposte ancorate alle fonti. Cuore di WidowBlue.',
    },
    {
      id: 'chunking',
      name: 'Chunking',
      body: 'Suddivisione dei documenti in segmenti (chunk) adatti a embedding e retrieval. Dimensione e overlap influenzano la qualità RAG.',
    },
    {
      id: 'tokenize',
      name: 'Tokenizzazione (BPE, SentencePiece)',
      body: 'Conversione del testo in token. BPE e SentencePiece sono algoritmi comuni nei tokenizer dei LLM.',
    },
    {
      id: 'cosine',
      name: 'Cosine Similarity',
      body: 'Misura di similarità tra vettori basata sull\'angolo; usata spesso per confrontare embedding.',
    },
    {
      id: 'etl',
      name: 'Data Pipeline / ETL',
      body: 'Flussi Extract-Transform-Load per preparare, pulire e caricare dati di training o di knowledge base.',
    },
    {
      id: 'dedup',
      name: 'Deduplicazione dati',
      body: 'Rimozione di testi duplicati o quasi-duplicati per migliorare qualità del training e del retrieval.',
    },
    {
      id: 'langchain',
      name: 'LangChain / LlamaIndex',
      body: 'Framework per orchestrare LLM, tool, memoria e indici documentali in applicazioni agentiche e RAG.',
    },
    {
      id: 'tooluse',
      name: 'Function Calling / Tool Use',
      body: 'Il modello invoca funzioni/API strutturate (calcoli, ricerca, DB) invece di rispondere solo a testo libero.',
    },
    {
      id: 'multiagent',
      name: 'Agenti autonomi multi-step',
      body: 'Sistemi che pianificano più passi, usano tool e verificano risultati prima della risposta finale.',
    },
    {
      id: 'semcache',
      name: 'Semantic Caching (Redis)',
      body: 'Cache di risposte o embedding basata su similarità semantica della query, non solo match esatto.',
    },
    {
      id: 'apiorch',
      name: 'Orchestrazione API (FastAPI, gRPC)',
      body: 'Backend che coordina chiamate a modelli, tool e servizi con API HTTP (FastAPI) o RPC (gRPC).',
    },
    {
      id: 'benchmark',
      name: 'Benchmark (MMLU, HellaSwag, GSM8K, HumanEval)',
      body: 'Suite di test standard per misurare conoscenze, ragionamento, matematica e capacità di codice dei modelli.',
    },
    {
      id: 'hallrate',
      name: 'Hallucination Rate',
      body: 'Tasso di risposte plausible ma non fondate sui fatti. Si riduce con RAG, citazioni, guardrail e verifica sulle fonti.',
    },
    {
      id: 'alignment',
      name: 'Alignment / Constitutional AI',
      body: 'Tecniche per allineare il comportamento del modello a valori e regole (es. Constitutional AI di Anthropic).',
    },
    {
      id: 'redteam',
      name: 'Red Teaming',
      body: 'Test avversariali deliberati per scoprire fallimenti di sicurezza, bias o comportamenti indesiderati.',
    },
    {
      id: 'promptinj',
      name: 'Prompt Injection',
      body: 'Attacco in cui input malevoli tentano di sovrascrivere istruzioni di sistema o far agire il modello fuori policy.',
    },
    {
      id: 'guardrails',
      name: 'Guardrails',
      body: 'Vincoli e filtri (policy, classificatori, regole) che limitano output non sicuri, fuori dominio o non allineati.',
    },
    {
      id: 'interpret',
      name: 'Interpretability',
      body: 'Metodi per capire perché un modello ha prodotto una certa uscita (attenzione, attribution, circuiti).',
    }
  ];

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
