# WidowBlue Auth Worker – setup

## File su GitHub (main)

```
src/worker.js          ← API auth
frontend/index.html    ← UI neurale
frontend/wb-auth.js    ← menu ⋮, login, cronologia
docs/SECURITY.md
docs/ROADMAP.md
docs/AUTH_SETUP.md     ← questo file
wrangler.toml
```

Repo: https://github.com/damon969gin-droid/Widowblue-D24GON

## Superadmin

Email: **giorgi.daniele96@gmail.com**  
Ruolo automatico `superadmin` alla registrazione/login.

## API

| Method | Path | Body / Header |
|--------|------|----------------|
| GET | `/api/health` | — |
| POST | `/api/auth/register` | `{ email, password }` |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/logout` | `Authorization: Bearer <token>` |
| GET | `/api/auth/me` | `Authorization: Bearer <token>` |
| POST | `/api/auth/timed-key` | Bearer (solo superadmin) |

Password: min 12 caratteri. Hash: **PBKDF2-SHA256 210k** + **salt** + **pepper** server.

## Setup Cloudflare (una volta)

```bash
npm i -D wrangler
npx wrangler login

# KV
npx wrangler kv namespace create AUTH_KV
npx wrangler kv namespace create AUTH_KV --preview
```

Copia gli `id` in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "AUTH_KV"
id = "..."
preview_id = "..."
```

```bash
# Pepper (segreto forte, non in git)
npx wrangler secret put PEPPER

npx wrangler deploy
```

## Deploy command Cloudflare (dashboard)

Se usi Git integration:

- **Build command**: `echo ok` (o vuoto)
- **Deploy command**: `npx wrangler deploy`
- Oppure togli deploy command e usa solo Pages assets se preferisci solo statico.

Con `main = "src/worker.js"` e `[assets]`, un solo Worker serve API + frontend.

## Frontend

`wb-auth.js` prova prima `/api/auth/*`; se KV non è configurato, resta il fallback localStorage (solo demo).

## Sicurezza prossima

- MFA TOTP (Google/Microsoft Authenticator)
- Argon2id se disponibile su Workers
- Cookie httpOnly oltre a Bearer
- WAF rate-limit su `/api/auth/login`
