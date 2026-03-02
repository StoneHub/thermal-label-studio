# Thermal Label Studio

Mobile-first MVP for editing and previewing thermal labels (4x6 @ 203 DPI).

## Workspace Layout

- `apps/web` — React editor UI (template picker, text/image fields, image pan/scale viewport, preview)
- `apps/api` — Express API (template list, apply overrides, render preview PNG)
- `packages/core` — shared template types + helper functions
- `packages/templates` — starter full-size + sticker templates

## Quick Start

```bash
pnpm install
pnpm dev
```

This starts API + web in watch mode.

### App URLs

- Web: `http://localhost:5173`
- API: `http://localhost:3001`

## Build check

```bash
pnpm build
```

## API endpoints

- `GET /health`
- `GET /templates?category=all|full|sticker`
- `POST /templates/:id/apply`
  - body: `{ "overrides": { "recipient_address": "Monroe\n123 Main" } }`
- `POST /templates/:id/render`
  - body: `{ "overrides": {...}, "imageTransforms": { "barcode": { "x": 8, "y": -12, "scale": 1.2 } } }`
  - returns `{ width, height, pngBase64 }`

## Phone / LAN testing

### Same Wi-Fi (recommended)

```bash
pnpm dev:share
```

This script starts API + web and prints:

- `LAN URL` for web (example `http://192.168.50.50:5173`)
- `API URL` (example `http://192.168.50.50:3001`)

Open the LAN URL on your phone browser.

### Optional public tunnel

```bash
pnpm dev:share:public
```

Requires `cloudflared`; prints a temporary `https://...trycloudflare.com` URL.

## MVP scope notes

- Preview PNG rendering is lightweight: text and image blocks are rendered for quick visual verification.
- Intended for rapid iteration and local testing before integrating full production rendering pipeline.
