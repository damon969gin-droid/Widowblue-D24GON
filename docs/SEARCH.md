# Ricerca modulare WidowBlue

## Principi

- Multi-provider in parallelo
- Tracciabile (`provider`, `url`, `snippet`)
- Solo API ufficiali (niente scraping SERP)

## Providers

| Nome | Secret | Note |
|------|--------|------|
| wikipedia | — | sempre |
| duckduckgo | — | sempre |
| brave | `BRAVE_API_KEY` | opzionale |
| google | `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` | Custom Search |
| **bing** | `BING_API_KEY` | Azure Bing Web Search v7 |
| **perplexity** | `PERPLEXITY_API_KEY` | Sonar + citazioni |

## Secret su Cloudflare **Pages**

Il progetto è collegato come **Pages**. Non usare `wrangler secret put` (è per Workers puri).

### Opzione A – CLI (Codespace)

Sostituisci `NOME_PROGETTO` con il nome Pages su Cloudflare (es. `widowblue-d24gon`):

```bash
npx wrangler pages secret put GOOGLE_API_KEY --project-name=NOME_PROGETTO
npx wrangler pages secret put GOOGLE_CSE_ID --project-name=NOME_PROGETTO
npx wrangler pages secret put BING_API_KEY --project-name=NOME_PROGETTO
npx wrangler pages secret put PERPLEXITY_API_KEY --project-name=NOME_PROGETTO
npx wrangler pages secret put BRAVE_API_KEY --project-name=NOME_PROGETTO
npx wrangler pages secret put PEPPER --project-name=NOME_PROGETTO
```

### Opzione B – Dashboard (più semplice)

1. Cloudflare Dashboard → **Workers & Pages** → il tuo progetto  
2. **Settings** → **Environment variables** (o **Secrets**)  
3. Aggiungi i secret sopra per **Production**  
4. **Retry deployment**

## Dove prendere le chiavi

- **Google**: Cloud Console + [Programmable Search](https://programmablesearchengine.google.com/) (`cx`)
- **Bing**: Azure Portal → risorsa **Bing Search v7** → Keys
- **Perplexity**: [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)
- **Brave**: [brave.com/search/api](https://brave.com/search/api/)

## Verifica

Dopo redeploy:

```text
GET /api/health
→ { "google": true, "bing": true, "perplexity": true, ... }
```
