# WidowBlue Architecture (v0.1)

## High-level

```
User (browser / app)
        │
        ▼
┌───────────────────┐
│  Frontend (exact  │  ← neural canvas + chat
│  HUD UI)          │
└─────────┬─────────┘
          │ WebSocket / HTTP / postMessage
          ▼
┌───────────────────┐
│  API Gateway      │  ← Cloudflare Workers / Node / FastAPI
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Orchestrator     │  ← plans, routes, aggregates
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
 Agents      Memory
 (sandbox)   (PG + Redis + Vector)
    │
    ▼
 Providers (local models / external APIs)
```

## Principles

1. **Open core** – MIT, modular, plugin system
2. **Local-first capable** – models can run on device or on your server
3. **User-controlled providers** – bring your own keys
4. **Respectful research** – multi-provider, rate-limited, license-aware
5. **Sandbox everything** that executes generated code
6. **Identical visual language** – the neural HUD is the face of the system

## Memory

- PostgreSQL → structured projects, conversations, preferences
- Redis → sessions, real-time agent state
- Vector DB + RAG → semantic search over past work, docs, code
- Knowledge Graph (future) → relationships between components

## Deployment targets (free / cheap start)

- Cloudflare Pages (frontend)
- Cloudflare Workers (API / orchestrator light)
- Cloudflare R2 / D1 / KV
- Later: Docker, Railway, Render, Vercel, self-hosted Linux
