# Exa – provider di ricerca predefinito

WidowBlue usa **Exa** come motore di ricerca principale.

## Secret Cloudflare Pages

Nel progetto Pages impostare (Production):

| Nome | Tipo |
|------|------|
| `EXA_API_KEY` | Secret / Encrypted |

Dashboard: **Workers & Pages** → progetto → **Settings** → **Variables and Secrets**.

## Comportamento

1. Se `EXA_API_KEY` è presente, Exa viene interrogato per primo.
2. I risultati Exa hanno lo score più alto e hanno priorità nella risposta.
3. Fallback: Google CSE, Serper, Tavily, Wikipedia, DuckDuckGo.

## Codice

- `src/search.js` → `searchExa()`, `pickBestAnswer()` prioritizza `provider === 'exa'`.
- Non committare mai la API key nel repository.
