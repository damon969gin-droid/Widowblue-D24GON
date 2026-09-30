# Ricerca modulare WidowBlue

## Principi

- **Multi-provider** in parallelo (Wikipedia, DuckDuckGo, Brave, Google)
- **Tracciabile**: `provider`, `url`, `snippet`, `fetchedAt`
- **Rispettosa**: API ufficiali, timeout 8s, **nessuno scraping Google**, no bypass paywall

## Providers

| Nome | Chiavi | Note |
|------|--------|------|
| wikipedia | — | sempre |
| duckduckgo | — | Instant Answer |
| brave | `BRAVE_API_KEY` | opzionale |
| **google** | `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` | Custom Search ufficiale |

## Setup Google

1. [Google Cloud](https://console.cloud.google.com/) → abilita **Custom Search API** → crea API key  
2. [Programmable Search Engine](https://programmablesearchengine.google.com/) → crea motore → copia **Search engine ID** (`cx`)  
3. Cloudflare:

```bash
npx wrangler secret put GOOGLE_API_KEY
npx wrangler secret put GOOGLE_CSE_ID
# opzionale
npx wrangler secret put BRAVE_API_KEY
```

Quota free tipica Google: ~100 query/giorno (controlla la console).

## API

```json
POST /api/search
{ "query": "fastapi vs express", "deep": true }
```

```json
POST /api/orchestrate
{ "prompt": "crea un SaaS", "deep": true, "search": true }
```

## Frontend

```js
await wbApi.search('cloudflare workers', true);
await wbApi.orchestrate(prompt, { deep: true });
```
