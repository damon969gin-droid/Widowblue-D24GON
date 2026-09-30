# WidowBlue Roadmap

Owner: damon969gin@gmail.com  
Repo: https://github.com/damon969gin-droid/Widowblue-D24GON  
Live UI: https://widowblue-d24gon.damon969gin.workers.dev

## Vision (target)

L'utente descrive un'idea tramite testo, voce (tutte le lingue), immagini, video, PDF, Office, link, GitHub, pagine web.  
WidowBlue analizza, pianifica, scrive codice, testa, documenta, crea repo e fa deploy — senza che l'utente programmi.

Ricerca web: **alta disponibilità, multi-provider, tracciabile, rispettosa** (robots.txt, rate limit, licenze). Non "illimitata assoluta".

Core open source, modelli locali o BYO API key, sandbox, plugin.

---

## 1. Architettura (sintesi)

```
UI (neural HUD) → API Gateway (CF Workers) → Orchestrator
                      ↓
              Agents (sandbox) + Memory (PG + Redis + Vector RAG)
                      ↓
         Providers (local / OpenAI-compatible) + Tools (search, git, deploy)
```

## 2. Diagrammi
Vedi `docs/ARCHITECTURE.md`. Diagrammi Mermaid da aggiungere in fase Orchestrator.

## 3. Struttura cartelle (attuale + target)

```
widowblue/
  frontend/          # HUD + chat + voice + allegati (LIVE)
  core/
    orchestrator/
    agents/
    memory/
    sandbox/
    providers/
  api/               # Workers / FastAPI
  docs/
  docker/
```

## 4. Database (target)

- PostgreSQL: projects, messages, files metadata, preferences
- Redis: sessioni, stato agenti real-time
- Vector DB + RAG: codice, docs, cronologia semantica
- (futuro) Knowledge Graph

## 5. API (target)

- `POST /api/run` — intent + allegati → piano / codice
- `POST /api/chat` — conversazione multi-turn
- `GET /api/projects` — memoria progetti
- `POST /api/search` — ricerca multi-provider tracciata
- WebSocket `/ws` — stato agenti → UI neurale

## 6. UI/UX

- Dark cyberpunk HUD, icosaedro pentagrammatico, blu elettrico
- Chat unificata: testo + voce multilingue + allegati nella stessa richiesta
- Toggle agenti, pannello risultati, export
- (fase 2) Visual builder tipo Figma semplificato

## 7. Milestone 30 giorni (MVP prioritario)

| Giorni | Deliverable |
|--------|-------------|
| 1–3 | UI esatta + chat + voce multilingue + allegati in richiesta (FATTO / in corso) |
| 4–7 | Worker API `/run` + provider AI BYO key |
| 8–12 | 8–10 agenti reali (Coordinatore, Frontend, Backend, DB, Design, Test, Deploy, Memoria) |
| 13–18 | Export progetto (zip / GitHub repo) |
| 19–24 | Deploy one-click Cloudflare/Vercel |
| 25–30 | Memoria base (D1/KV o Postgres) + ricerca web modulare tracciata |

## 8. Codice iniziale

- `frontend/index.html` — HUD + orchestrator locale
- MIT license, wrangler.toml, GitHub Action

## 9. Piano di test

- Smoke: load UI, voice (Chrome), attach txt, invia → piano
- Agenti: attivazione nodi + log
- (dopo API) contract test su `/run`

## 10. Piano di deploy

- Frontend: Cloudflare Workers assets / Pages
- API: Cloudflare Workers
- DB: Neon o Supabase (free tier)

## 11. Realizzabile subito (ora)

- Grafica neurale identica
- Chat testo
- Voce → testo (browser)
- Allegati in richiesta
- Piano multi-agente locale + bozze codice
- Toggle tutti gli agenti
- Export piano

## 12. Sviluppo successivo

- Visual builder drag-and-drop → codice
- Analisi pagine web (struttura, no copy proprietario)
- Multimedia generation (img/video/audio)
- Tutti i formati file + chunked upload
- Migliaia di agenti concorrenti
- RAG + knowledge graph
- Mobile app nativa

## 13. Priorità assoluta MVP 30gg

1. Chat unificata (testo/voce/file/link)  
2. Orchestrator + provider AI  
3. Generazione progetto scaricabile  
4. Deploy automatico  
5. Ricerca web multi-provider rispettosa  
