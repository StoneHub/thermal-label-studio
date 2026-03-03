# Thermal Label Studio

Interactive label composer for 4x6 thermal labels (800x1200 @ 203 DPI). Mobile-first design, desktop keyboard shortcuts, template system, and automation API.

## Workspace Layout

```
apps/web        — React + Konva canvas editor (drag/resize/rotate, layers, templates)
apps/api        — Express API (CRUD templates, render PNG, print jobs, automation)
packages/core   — Shared types, layer helpers, snap/alignment, placeholders
packages/templates — Starter template JSON packs
```

## Quick Start

```bash
pnpm install
pnpm dev
```

Starts API + web in watch mode.

| Service | URL |
|---------|-----|
| Web editor | `http://localhost:5173` |
| API | `http://localhost:3001` |

## Build & Test

```bash
pnpm build       # Build all packages
pnpm test        # Run vitest test suite
pnpm test:watch  # Watch mode
pnpm typecheck   # TypeScript check
```

## Editor Features

### Canvas Editor
- **Multi-layer editing**: Text, shapes (rect/circle), and images on an 800x1200 canvas
- **Transform controls**: Drag to move, handles to resize, rotate anchor for rotation
- **Snap guides**: Layers snap to canvas edges, centers, and other layer edges (toggle with toolbar)
- **Grid overlay**: 25px grid for alignment (toggle with toolbar)
- **Z-order**: Bring forward/backward, send to front/back
- **Undo/redo**: Full history with 50-step limit

### Layer Properties
- **Text**: Font family, size, weight, alignment, color
- **Shapes**: Fill, stroke, corner radius, stroke width
- **Images**: Upload, fit mode (contain/cover/fill)
- **All layers**: Position (X/Y), size (W/H), rotation, opacity, lock, visibility

### Templates
- 9 built-in templates: shipping, drawer labels, craft supplies, storage boxes, feeding charts, instruction lists, sticker sheets
- Save current canvas as a reusable template (localStorage)
- Template browser with category filter (Full 4x6 / Sticker Sheet)
- Placeholder fields with `{{key}}` substitution

### Keyboard Shortcuts (Desktop)
| Key | Action |
|-----|--------|
| `T` | Add text layer |
| `R` | Add rectangle |
| `Delete` / `Backspace` | Delete selected |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+C` / `Ctrl+V` | Copy / Paste |
| `Ctrl+D` | Duplicate |
| `Ctrl+A` | Select all |
| `Arrow keys` | Nudge (1px, +Shift 10px) |
| `Ctrl+]` / `Ctrl+[` | Z-order forward/backward |
| `Ctrl+=` / `Ctrl+-` | Zoom in/out |
| `Ctrl+0` | Reset zoom |
| `Escape` | Deselect all |

### Mobile
- Bottom tab navigation: Layers / Canvas / Properties
- Touch: tap to select, drag to move, pinch to zoom canvas
- Responsive layout adapts at 768px breakpoint

## API Endpoints

### Health
```
GET /health → { ok, service, version }
```

### Templates
```
GET    /templates?category=all|full|sticker   → { templates[] }
GET    /templates/:id                         → { template }
GET    /templates/:id/schema                  → { fields, canvasSize }
POST   /templates                             → { ok, id }
DELETE /templates/:id                         → { ok, deleted }
POST   /templates/:id/apply                   → { template }
PATCH  /templates/:id/fields                  → { ok, template }
POST   /templates/:id/render                  → { ok, width, height, pngBase64 }
```

### Render
```
POST /render/from-canvas   → { ok, width, height, pngBase64 }
  body: { pngDataUrl: "data:image/png;base64,..." }
```

### Print Jobs
```
POST /print/jobs           → { ok, jobId, status }
  body: { templateId, overrides?, copies? }
GET  /print/jobs           → { jobs[] }
GET  /print/jobs/:id       → { job }
```

## OpenClaw Automation Examples

### List available templates
```bash
curl http://localhost:3001/templates | jq '.templates[].name'
```

### Get template schema (for automation)
```bash
curl http://localhost:3001/templates/shipping-label/schema | jq
```

### Render a label with overrides
```bash
curl -X POST http://localhost:3001/templates/shipping-label/render \
  -H "Content-Type: application/json" \
  -d '{"overrides":{"name":"Alice","address1":"123 Main St"}}' \
  | jq -r '.pngBase64' | base64 -d > label.png
```

### Queue a print job
```bash
curl -X POST http://localhost:3001/print/jobs \
  -H "Content-Type: application/json" \
  -d '{"templateId":"shipping-label","overrides":{"name":"Bob"},"copies":2}'
```

### Telegram automation flow
```
User → "Print a drawer label for Socks"
Bot → GET /templates/drawer-label/schema
Bot → POST /templates/drawer-label/render { overrides: { title: "Socks" } }
Bot → POST /print/jobs { templateId: "drawer-label", overrides: { title: "Socks" } }
Bot → "Label printed! Here's a preview: [image]"
```

## Phone / LAN Testing

### Same Wi-Fi
```bash
pnpm dev:share
```
Prints LAN URLs for both web and API.

### Public tunnel
```bash
pnpm dev:share:public
```
Requires `cloudflared`; prints a temporary `https://...trycloudflare.com` URL.

## Architecture Notes

- Canvas: 800x1200px target (matches 4x6" @ 203 DPI thermal printer)
- Frontend renders via Konva (HTML5 Canvas) for WYSIWYG editing
- API renders structural PNG (block-level) for server-side automation
- Print pipeline contract: `thermal_print.sh --input <png> --copies <n>`
- Templates use `{{placeholder}}` syntax for field substitution
