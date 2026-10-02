/**
 * WidowBlue – Curriculum AI (7 parti)
 * Mappa concettuale usata per routing agenti e contesto RAG.
 * Non modifica il flusso chat: solo arricchimento opzionale.
 */

export const AI_CURRICULUM = [
  {
    id: 1,
    title: 'Basi dell\'intelligenza artificiale',
    slug: 'basi-ai',
    domains: ['analysis', 'ml', 'search'],
    topics: [
      { id: 'narrow-general', name: 'AI ristretta e generale', keywords: ['ai ristretta', 'agi', 'narrow ai', 'general ai', 'intelligenza generale'] },
      { id: 'gen-pred', name: 'AI generativa e predittiva', keywords: ['generativa', 'predittiva', 'generative', 'predictive'] },
      { id: 'algorithm', name: 'Algoritmo', keywords: ['algoritmo', 'algorithm'] },
      { id: 'model', name: 'Modello', keywords: ['modello ai', 'model', 'modello di machine'] },
      { id: 'heuristic', name: 'Euristica', keywords: ['euristica', 'heuristic'] },
      { id: 'emergent', name: 'Comportamento emergente', keywords: ['emergente', 'emergent behavior', 'comportamento emergente'] },
    ],
  },
  {
    id: 2,
    title: 'Apprendimento automatico e reti neurali',
    slug: 'ml-nn',
    domains: ['ml', 'math', 'analysis'],
    topics: [
      { id: 'ml', name: 'Machine learning', keywords: ['machine learning', 'apprendimento automatico', 'ml'] },
      { id: 'supervised', name: 'Supervisionato e non', keywords: ['supervisionato', 'non supervisionato', 'supervised', 'unsupervised', 'semi-supervised'] },
      { id: 'nn', name: 'Reti neurali', keywords: ['rete neurale', 'reti neurali', 'neural network', 'neurone'] },
      { id: 'dl', name: 'Deep learning', keywords: ['deep learning', 'apprendimento profondo'] },
      { id: 'backprop', name: 'Backpropagation', keywords: ['backpropagation', 'backprop', 'discesa del gradiente', 'gradient descent'] },
      { id: 'overfit', name: 'Overfitting', keywords: ['overfitting', 'sovraadattamento', 'underfitting'] },
    ],
  },
  {
    id: 3,
    title: 'Dati, addestramento e ottimizzazione',
    slug: 'dati-training',
    domains: ['ml', 'code', 'analysis'],
    topics: [
      { id: 'features', name: 'Dati e feature', keywords: ['feature', 'dataset', 'dati di addestramento', 'features'] },
      { id: 'split', name: 'Training, validazione, test', keywords: ['training set', 'validation', 'test set', 'validazione', 'addestramento'] },
      { id: 'token', name: 'Token', keywords: ['token', 'tokenizzazione', 'tokenizer'] },
      { id: 'embedding', name: 'Embedding', keywords: ['embedding', 'vettore', 'embeddings'] },
      { id: 'finetune', name: 'Fine-tuning', keywords: ['fine-tuning', 'fine tuning', 'lora', 'qlora'] },
      { id: 'hyper', name: 'Iperparametri', keywords: ['iperparametri', 'hyperparameter', 'learning rate', 'batch size'] },
    ],
  },
  {
    id: 4,
    title: 'Metriche e valutazione dei modelli',
    slug: 'metriche',
    domains: ['ml', 'math', 'analysis'],
    topics: [
      { id: 'accuracy', name: 'Accuratezza', keywords: ['accuratezza', 'accuracy'] },
      { id: 'precision-recall', name: 'Precisione e richiamo', keywords: ['precisione', 'richiamo', 'precision', 'recall'] },
      { id: 'f1', name: 'F1-score', keywords: ['f1', 'f1-score', 'f-score'] },
      { id: 'confusion', name: 'Matrice di confusione', keywords: ['matrice di confusione', 'confusion matrix'] },
      { id: 'inference', name: 'Inferenza', keywords: ['inferenza', 'inference', 'latenza modello'] },
    ],
  },
  {
    id: 5,
    title: 'AI generativa e modelli linguistici',
    slug: 'gen-llm',
    domains: ['ml', 'content', 'search'],
    topics: [
      { id: 'nlp', name: 'NLP', keywords: ['nlp', 'natural language', 'linguaggio naturale'] },
      { id: 'llm', name: 'LLM', keywords: ['llm', 'large language model', 'modello linguistico'] },
      { id: 'transformer', name: 'Transformer e attenzione', keywords: ['transformer', 'attenzione', 'attention', 'self-attention'] },
      { id: 'gpt-bert', name: 'GPT e BERT', keywords: ['gpt', 'bert', 'chatgpt'] },
      { id: 'multimodal', name: 'Multimodale', keywords: ['multimodale', 'multimodal', 'vision-language'] },
      { id: 'hallucination', name: 'Allucinazione', keywords: ['allucinazione', 'hallucination', 'allucinazioni'] },
    ],
  },
  {
    id: 6,
    title: 'Linguaggio applicato e visione artificiale',
    slug: 'nlp-vision',
    domains: ['ml', 'image', 'content'],
    topics: [
      { id: 'sentiment', name: 'Analisi del sentimento', keywords: ['sentiment', 'sentimento', 'analisi del sentimento'] },
      { id: 'ner', name: 'NER', keywords: ['ner', 'named entity', 'entità nominate'] },
      { id: 'cv', name: 'Computer vision', keywords: ['computer vision', 'visione artificiale'] },
      { id: 'cnn', name: 'CNN', keywords: ['cnn', 'convolutional', 'rete convoluzionale'] },
      { id: 'odetect', name: 'Object detection', keywords: ['object detection', 'rilevamento oggetti', 'yolo'] },
      { id: 'ocr', name: 'OCR', keywords: ['ocr', 'riconoscimento testo', 'optical character'] },
    ],
  },
  {
    id: 7,
    title: 'Agenti, strumenti e automazione',
    slug: 'agenti',
    domains: ['search', 'code', 'analysis', 'ml'],
    topics: [
      { id: 'agent', name: 'Agente AI', keywords: ['agente ai', 'ai agent', 'agente'] },
      { id: 'agentic', name: 'AI agentica', keywords: ['agentica', 'agentic', 'multi-agente', 'multi agent'] },
      { id: 'tools', name: 'Strumenti', keywords: ['tool use', 'function calling', 'strumenti ai'] },
      { id: 'rag', name: 'RAG', keywords: ['rag', 'retrieval augmented', 'retrieval-augmented'] },
      { id: 'mcp', name: 'MCP', keywords: ['mcp', 'model context protocol'] },
      { id: 'orchestration', name: 'Orchestrazione', keywords: ['orchestrazione', 'orchestration', 'orchestrator'] },
    ],
  },
];

/** Specialità curriculum da mescolare nel catalogo agenti */
export const CURRICULUM_SPECS = [
  { s: 'ai-foundations', domain: 'ml', task: 'Spiega basi AI ristretta/generale', part: 1 },
  { s: 'gen-vs-pred', domain: 'ml', task: 'Distingue AI generativa e predittiva', part: 1 },
  { s: 'heuristics', domain: 'analysis', task: 'Applica euristiche e trade-off', part: 1 },
  { s: 'emergent-behavior', domain: 'analysis', task: 'Analizza comportamenti emergenti', part: 1 },
  { s: 'supervised-ml', domain: 'ml', task: 'Apprendimento supervisionato / non', part: 2 },
  { s: 'neural-nets', domain: 'ml', task: 'Architetture di reti neurali', part: 2 },
  { s: 'deep-learning', domain: 'ml', task: 'Deep learning e layer', part: 2 },
  { s: 'backprop', domain: 'ml', task: 'Backpropagation e gradienti', part: 2 },
  { s: 'overfitting-guard', domain: 'ml', task: 'Previene overfitting', part: 2 },
  { s: 'feature-eng', domain: 'ml', task: 'Feature engineering e dataset', part: 3 },
  { s: 'train-val-test', domain: 'ml', task: 'Split training/validazione/test', part: 3 },
  { s: 'tokenization', domain: 'ml', task: 'Tokenizzazione del testo', part: 3 },
  { s: 'embeddings', domain: 'ml', task: 'Embedding e similarità vettoriale', part: 3 },
  { s: 'fine-tuning', domain: 'ml', task: 'Fine-tuning e adapter (LoRA)', part: 3 },
  { s: 'hyperparams', domain: 'ml', task: 'Scelta iperparametri', part: 3 },
  { s: 'metrics-eval', domain: 'math', task: 'Accuratezza, precision, recall, F1', part: 4 },
  { s: 'confusion-matrix', domain: 'math', task: 'Matrice di confusione', part: 4 },
  { s: 'inference-opt', domain: 'ml', task: 'Inferenza e latenza modelli', part: 4 },
  { s: 'nlp-core', domain: 'ml', task: 'NLP e comprensione testo', part: 5 },
  { s: 'llm-arch', domain: 'ml', task: 'Architetture LLM', part: 5 },
  { s: 'transformers', domain: 'ml', task: 'Transformer e attenzione', part: 5 },
  { s: 'gpt-bert', domain: 'ml', task: 'Famiglie GPT/BERT', part: 5 },
  { s: 'multimodal', domain: 'image', task: 'Modelli multimodali', part: 5 },
  { s: 'hallucination-check', domain: 'search', task: 'Rileva e riduce allucinazioni', part: 5 },
  { s: 'sentiment', domain: 'ml', task: 'Analisi del sentimento', part: 6 },
  { s: 'ner', domain: 'ml', task: 'Named Entity Recognition', part: 6 },
  { s: 'computer-vision', domain: 'image', task: 'Computer vision', part: 6 },
  { s: 'cnn-vision', domain: 'image', task: 'CNN e feature visive', part: 6 },
  { s: 'object-detect', domain: 'image', task: 'Object detection', part: 6 },
  { s: 'ocr-vision', domain: 'image', task: 'OCR e testo da immagine', part: 6 },
  { s: 'ai-agent', domain: 'analysis', task: 'Progetta agenti AI', part: 7 },
  { s: 'agentic-flow', domain: 'analysis', task: 'Flussi AI agentica multi-step', part: 7 },
  { s: 'tool-use', domain: 'code', task: 'Tool use e function calling', part: 7 },
  { s: 'rag-pipeline', domain: 'search', task: 'Pipeline RAG retrieval+generate', part: 7 },
  { s: 'mcp-protocol', domain: 'code', task: 'MCP e connettori strumenti', part: 7 },
  { s: 'orchestration', domain: 'analysis', task: 'Orchestrazione multi-agente', part: 7 },
];

/**
 * Trova parti/topic del curriculum che matchano la query.
 * Ritorna [] se nessun match (chat resta invariata).
 */
export function matchCurriculum(query) {
  const q = String(query || '').toLowerCase();
  if (!q || q.length < 3) return [];
  const hits = [];
  for (const part of AI_CURRICULUM) {
    const matchedTopics = [];
    for (const t of part.topics) {
      if (t.keywords.some((k) => q.includes(k.toLowerCase()))) {
        matchedTopics.push({ id: t.id, name: t.name });
      }
    }
    // match sul titolo della parte
    if (!matchedTopics.length) {
      const titleBits = part.title.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      if (titleBits.some((w) => q.includes(w))) {
        matchedTopics.push({ id: part.slug, name: part.title });
      }
    }
    if (matchedTopics.length) {
      hits.push({
        part: part.id,
        title: part.title,
        slug: part.slug,
        domains: part.domains,
        topics: matchedTopics,
      });
    }
  }
  return hits;
}

/** Domini prioritari derivati dal curriculum match */
export function curriculumDomains(query) {
  const hits = matchCurriculum(query);
  const set = new Set();
  hits.forEach((h) => (h.domains || []).forEach((d) => set.add(d)));
  return [...set];
}

export function curriculumSummary() {
  return AI_CURRICULUM.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    domains: p.domains,
    topics: p.topics.map((t) => t.name),
  }));
}
