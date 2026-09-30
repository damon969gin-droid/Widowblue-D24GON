# WidowBlue (D24GON)

Piattaforma AI agentica open source – HUD neurale, multi-agente, auth Worker, Cloudflare.

**Repo:** https://github.com/damon969gin-droid/Widowblue-D24GON  
**Live:** https://widowblue-d24gon.damon969gin.workers.dev  
**Superadmin:** giorgi.daniele96@gmail.com

## Struttura su `main`

```
frontend/index.html      HUD + chat + voce + allegati
frontend/wb-auth.js      Menu ⋮ cronologia, login, dashboard
src/worker.js            API auth + static assets
docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/SECURITY.md         NIS2, MFA, spider, 3-2-1
docs/AUTH_SETUP.md       KV + PEPPER + deploy
wrangler.toml
package.json
LICENSE
```

## Auth API

| Endpoint | Descrizione |
|----------|-------------|
| `POST /api/auth/register` | `{ email, password }` |
| `POST /api/auth/login` | `{ email, password }` → token |
| `GET /api/auth/me` | Bearer token |
| `POST /api/auth/logout` | Bearer token |
| `POST /api/auth/timed-key` | Solo superadmin |
| `GET /api/health` | Health check |

Hash: PBKDF2-SHA256 210k + salt + **pepper** server.

## Setup (obbligatorio per auth server)

Vedi [docs/AUTH_SETUP.md](docs/AUTH_SETUP.md):

```bash
npx wrangler kv namespace create AUTH_KV
# incolla id in wrangler.toml
npx wrangler secret put PEPPER
npx wrangler deploy
```

## UI

Menu **⋮** → cronologia (elimina), Accedi/Registrati, Dashboard sicurezza (solo admin).

## Prossimi step

1. Ricerca web modulare multi-provider  
2. Orchestrator + provider AI  
3. MFA TOTP  

MIT License – contact damon969gin@gmail.com
