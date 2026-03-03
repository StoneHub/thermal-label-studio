# Thermal Label Studio

Design, preview, and automate 4x6 thermal labels with a modern editor and API.

Thermal Label Studio combines:
- a visual label editor (`apps/web`)
- a local automation/print API (`apps/api`)
- shared schema + layer logic (`packages/core`)
- reusable template packs (`packages/templates`)

Target canvas is `800x1200` (optimized for 4x6 @ 203 DPI workflows).

## Highlights

- Drag-and-drop multi-layer canvas (text, shapes, images)
- Image upload + reusable image library
- Clipboard image paste (`Ctrl/Cmd+V`)
- Snap guides, grid, transforms, z-order controls
- Undo/redo history
- Template browser + local template saves
- Mobile-friendly editing layout
- API for template ops, render, and print-job orchestration

## Portfolio Demo

When running locally or on LAN:
- Editor: `http://localhost:5173`
- API: `http://localhost:3001`

Suggested portfolio assets:
- `docs/screenshots/editor-main.png`
- `docs/screenshots/template-browser.png`
- `docs/screenshots/mobile-layout.png`
- `docs/demo.gif`

## Project Structure

```text
apps/web             React + Vite + Konva editor
apps/api             Express API for templates/render/print jobs
packages/core        Shared types and editor helpers
packages/templates   Starter template packs
```

## Quick Start

```bash
pnpm install
pnpm dev
```

Services:
- Web: `http://localhost:5173`
- API: `http://localhost:3001`

## LAN / Device Testing

```bash
pnpm dev:share
```

Prints LAN-accessible URLs for web + API.

Optional public tunnel:

```bash
pnpm dev:share:public
```

Requires `cloudflared`.

## Scripts

```bash
pnpm dev           # run all dev services
pnpm build         # build all packages
pnpm typecheck     # TS checks
pnpm test          # vitest
pnpm test:watch    # vitest watch mode
```

## Keyboard Shortcuts

- `T`: Add text
- `R`: Add rectangle
- `Delete` / `Backspace`: Delete selected
- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y`: Redo
- `Ctrl/Cmd + C`: Copy selected layers
- `Ctrl/Cmd + V`: Paste layers or pasted clipboard image
- `Ctrl/Cmd + D`: Duplicate
- `Ctrl/Cmd + A`: Select all
- `Arrow Keys`: Nudge (`Shift` = 10px)
- `Ctrl/Cmd + ]` / `Ctrl/Cmd + [`: Z-order
- `Ctrl/Cmd + +/-/0`: Zoom controls

## API Overview

### Health

```http
GET /health
```

### Templates

```http
GET    /templates?category=all|full|sticker
GET    /templates/:id
GET    /templates/:id/schema
POST   /templates
DELETE /templates/:id
POST   /templates/:id/apply
PATCH  /templates/:id/fields
POST   /templates/:id/render
```

### Render

```http
POST /render/from-canvas
```

Body:

```json
{ "pngDataUrl": "data:image/png;base64,..." }
```

### Print Jobs

```http
POST /print/jobs
GET  /print/jobs
GET  /print/jobs/:id
```

## Automation Examples

List templates:

```bash
curl http://localhost:3001/templates | jq '.templates[].name'
```

Render with overrides:

```bash
curl -X POST http://localhost:3001/templates/shipping-label/render \
  -H "Content-Type: application/json" \
  -d '{"overrides":{"name":"Alice","address1":"123 Main St"}}' \
  | jq -r '.pngBase64' | base64 -d > label.png
```

Queue a print job:

```bash
curl -X POST http://localhost:3001/print/jobs \
  -H "Content-Type: application/json" \
  -d '{"templateId":"shipping-label","overrides":{"name":"Bob"},"copies":2}'
```

## Roadmap

- Real printer execution pipeline + robust job status/retries
- Render parity between editor and API output
- Shared persistent asset/template storage
- Agent-assisted design suggestions and auto-fix workflows
- One-click "prepare for print" quality checks

## License

MIT. See [LICENSE](./LICENSE).
