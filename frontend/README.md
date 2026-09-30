# WidowBlue Frontend

Exact visual shell of WidowBlue:

- Dark cyberpunk / HUD theme
- Neural network canvas (cyan #4de1ff + amber #ffb347)
- Agent nodes with labels
- Drag to rotate
- Bottom chat bar (text + voice + send)
- Font: Rajdhani

This is the **identical** graphics from the original prototype, cleaned of any external platform branding and made fully self-hosted / open-source.

## Run locally

```bash
npx serve . -p 8080
# or
python3 -m http.server 8080
```

## Cloudflare Pages

Point the build output to this `frontend/` folder (already configured in root `wrangler.toml`).
