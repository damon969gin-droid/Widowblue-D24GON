# WidowBlue – Database D1 e 453 agenti

## Agenti (catalogo)

- **453 totali**: 12 leader di ruolo + 441 worker
- Ruoli: Coordinatore, Frontend, Backend, Design, Database, Media, Voce, Test, Memoria, Deploy, Sicurezza, Documenti
- 3 shell di worker (25% / 35% / 40%)
- Codice: `src/agents.js`
- HUD canvas allineato a 453 nodi

### API (senza D1: risposta in-memory)

```bash
curl -sS https://widowblue-d24gon.damon969gin.workers.dev/api/agents/stats | python3 -m json.tool
curl -sS "https://widowblue-d24gon.damon969gin.workers.dev/api/agents?limit=12" | python3 -m json.tool
```

## Cloudflare D1 (gratuito)

### 1. Crea database

```bash
npx wrangler d1 create widowblue-db
```

Copia il `database_id` e decommenta in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "widowblue-db"
database_id = "YOUR_D1_DATABASE_ID"
```

### 2. Schema

```bash
npx wrangler d1 execute widowblue-db --remote --file=./migrations/0001_init.sql
```

Tabelle: `users`, `sessions`, `conversations`, `messages`, `agents`, `agent_runs`, `search_logs`, `security_events`.

### 3. Seed 453 agenti

Dopo il deploy:

```bash
curl -sS -X POST https://widowblue-d24gon.damon969gin.workers.dev/api/agents/seed | python3 -m json.tool
```

Oppure in locale con binding:

```bash
npx wrangler d1 execute widowblue-db --remote --command="SELECT COUNT(*) FROM agents"
```

### 4. Health

```bash
curl -sS https://widowblue-d24gon.damon969gin.workers.dev/api/health | python3 -m json.tool
# d1: true, agents: 453
```

## AUTH_KV (opzionale in parallelo)

Per login email/password resta KV:

```bash
npx wrangler kv namespace create AUTH_KV
# aggiungi binding in wrangler.toml
```

## Prossimi passi

1. Persistenza chat su D1 (`conversations` / `messages`)
2. `agent_runs` per tracciare task multi-agente
3. Dashboard admin superadmin su `giorgi.daniele96@gmail.com`
