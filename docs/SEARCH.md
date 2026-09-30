# Ricerca modulare WidowBlue

## Principi

- **Multi-provider**: Wikipedia + DuckDuckGo (+ Brave se configurato)
- **Tracciabile**: ogni risultato ha `provider`, `url`, `snippet`, `fetchedAt`
- **Rispettosa**: User-Agent dedicato, timeout 8s, no bypass paywall/CAPTCHA, no scrap aggressivo
- **Alta disponibilità**: provider in parallelo; se uno fallisce gli altri continuano

## API

### `POST /api/search`

```json
{ "query": "fastapi vs express", "deep": true }
```

Risposta: `{ ok, query, providers[], results[], policy, fetchedAt }`

### `POST /api/orchestrate`

```json
{ "prompt": "crea un SaaS con auth", "deep": true, "search": true }
```

Risposta: `{ ok, plan, search }` — piano stack/steps + fonti web.

## Providers

| Nome | Chiave | Note |
|------|--------|------|
| wikipedia | no | OpenSearch API |
| duckduckgo | no | Instant Answer API |
| brave | `BRAVE_API_KEY` | Opzionale, più risultati web |

```bash
npx wrangler secret put BRAVE_API_KEY
```

## Frontend

```js
const r = await wbApi.search('cloudflare workers', true);
const o = await wbApi.orchestrate(prompt, { deep: allMode });
```

Con **Tutti gli agenti** il client passa `deep: true` → più fonti e piano esteso.
