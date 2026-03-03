# Thermal Label Studio — V1 Release Notes (DRAFT)

## Overview

V1 transforms the MVP from a basic template-fill form into a full interactive label composer with a canvas editor, template system, automation API, and mobile support.

## What's New

### Interactive Canvas Editor
- **Multi-layer canvas**: Add text, shapes (rectangles, circles), and images to an 800x1200 canvas
- **Direct manipulation**: Drag to move, resize handles on all edges/corners, rotation anchor
- **Snap guides**: Layers snap to canvas edges, canvas center, and edges of other layers (6px threshold)
- **Grid overlay**: 25px grid for precise alignment
- **Z-order controls**: Bring forward/backward, send to front/back via panel buttons or keyboard
- **Selection**: Click to select, Shift+click for multi-select, Escape to deselect
- **Undo/redo**: Full 50-step history for all canvas operations

### Layer Properties Panel
- **Text layers**: Editable text content, font family (6 options), font size, weight (light→extra bold), text alignment, color picker
- **Shape layers**: Shape type, fill color, stroke color, stroke width, corner radius
- **Image layers**: File upload, fit mode (contain/cover/fill)
- **Transform controls**: Precise X/Y/W/H inputs, rotation angle, opacity slider
- **Layer management**: Lock/unlock, show/hide, per-layer controls

### Template System
- **9 built-in templates**: Shipping labels, drawer labels, craft supply bins, storage box labels, feeding charts, instruction lists, blank templates, sticker sheets
- **Template browser**: Modal with mini SVG previews, category filtering, tag display
- **Save/load**: Save current canvas as reusable template (localStorage persistence)
- **Placeholder fields**: `{{key}}` syntax for automation-friendly templates

### Desktop Keyboard Shortcuts
- Standard shortcuts: Ctrl+Z/Y (undo/redo), Ctrl+C/V (copy/paste), Ctrl+D (duplicate), Ctrl+A (select all)
- Quick add: T (text), R (rectangle)
- Nudge: Arrow keys (1px), Shift+Arrow (10px)
- Z-order: Ctrl+]/[ (forward/backward), Ctrl+Shift+]/[ (front/back)
- Zoom: Ctrl+=/- (zoom in/out), Ctrl+0 (reset)

### Mobile-First Responsive Layout
- Bottom tab navigation (Layers / Canvas / Properties)
- Touch-optimized controls
- Breakpoint at 768px: stacked mobile → three-panel desktop
- Full-height viewport using `100dvh`

### API Expansion
- **CRUD templates**: GET/POST/DELETE templates
- **Schema endpoint**: GET `/templates/:id/schema` — returns field definitions for automation
- **Field updates**: PATCH `/templates/:id/fields` — update specific placeholders
- **Canvas render**: POST `/render/from-canvas` — accepts client-side PNG, resizes via sharp
- **Print jobs**: POST `/print/jobs` with queue, status tracking, and job history
- **Zod validation**: Request bodies validated with Zod schemas
- **Error handling**: Structured error responses with details

### Test Coverage
- **Core package**: 20+ tests covering unit conversions, placeholder extraction, field overrides, layer creation/manipulation, snap guides, alignment, ID generation
- **Editor reducer**: 15+ tests covering state management, undo/redo, layer CRUD, z-order, copy/paste, view controls
- **Test runner**: Vitest configured at workspace root

### UI Polish
- Clean design system: CSS custom properties, consistent spacing, shadows, transitions
- Status bar: Template name, layer count, selection count, canvas dimensions
- Toast notifications for save/export actions
- Empty states for panels
- Loading indicator in template browser

## How to Demo

1. **Start dev server**: `pnpm install && pnpm dev`
2. **Open editor**: `http://localhost:5173`
3. **Try templates**: Click "Templates" → browse and select a starter template
4. **Edit layers**: Click layers on canvas to select, drag to move, use handles to resize/rotate
5. **Add content**: Use toolbar to add text, rectangles, circles, or images
6. **Properties**: Select a layer and edit properties in the right panel
7. **Keyboard**: Try T (add text), Ctrl+D (duplicate), arrow keys (nudge), Ctrl+Z (undo)
8. **Mobile**: Open on phone via `pnpm dev:share` LAN URL
9. **API**: `curl http://localhost:3001/templates | jq` to list templates
10. **Print job**: POST to `/print/jobs` with a template ID and overrides

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Web Editor (React + Konva)                     │
│  ┌──────────┬───────────────┬──────────────┐   │
│  │  Layers  │  800x1200     │  Properties  │   │
│  │  Panel   │  Canvas       │  Panel       │   │
│  │          │  (snap/grid)  │              │   │
│  └──────────┴───────────────┴──────────────┘   │
│  └─── Toolbar: add/undo/zoom/save/export ──┘   │
│  └─── Status Bar ─────────────────────────┘    │
│  └─── Mobile: Tab Nav ────────────────────┘    │
└─────────────────────────────────────────────────┘
        │ fetch/POST
┌───────▼─────────────────────────────────────────┐
│  API Server (Express)                           │
│  /templates — CRUD + schema + render            │
│  /render/from-canvas — sharp resize             │
│  /print/jobs — queue + status                   │
└─────────────────────────────────────────────────┘
        │ contract
┌───────▼─────────────────────────────────────────┐
│  thermal_print.sh --input <png> --copies <n>    │
└─────────────────────────────────────────────────┘
```

## Known Gaps / V2 Candidates

1. **Server-side text rendering**: API renders blocks, not actual text with fonts. For pixel-perfect automation output, needs node-canvas or headless browser rendering.
2. **Font loading**: Editor uses system/web fonts. Custom font upload not implemented.
3. **Image compositing on server**: Sharp resize works, but full compositing with layers needs more work.
4. **Template versioning**: No version history for saved templates.
5. **Real print integration**: Print job queue is simulated. Needs actual `thermal_print.sh` script or USB printer driver integration.
6. **User auth**: No authentication on API. Fine for local use, needs auth for multi-user.
7. **QR/barcode generation**: Not implemented (would be a great V2 feature).
8. **Multi-page sticker cutting**: Sticker sheet mode renders but doesn't generate cut lines.
9. **Rich v1 template schema**: The 10 "v1 schema" templates in `packages/templates/` use a different schema and aren't wired into the app yet.
10. **Persistent storage**: Templates save to localStorage only. Server-side persistence (SQLite/file) planned.

## Dependencies Added

- `konva` + `react-konva` — Canvas rendering and interaction
- `@vitejs/plugin-react` — React JSX/HMR support
- `sharp` — Server-side image processing
- `multer` — File upload handling
- `vitest` — Test runner

## Files Changed/Created

### New Files
- `apps/web/src/App.tsx` — Main app shell with three-panel layout
- `apps/web/src/components/EditorCanvas.tsx` — Konva canvas with layers, snap, grid
- `apps/web/src/components/Toolbar.tsx` — Top toolbar
- `apps/web/src/components/LayerPanel.tsx` — Layer list with z-order/align
- `apps/web/src/components/PropertiesPanel.tsx` — Selected layer property editor
- `apps/web/src/components/TemplateBrowser.tsx` — Template browser modal
- `apps/web/src/state/editorReducer.ts` — Editor state with undo/redo
- `apps/web/src/state/editorReducer.test.ts` — Reducer tests
- `apps/web/src/hooks/useEditorState.ts` — State hook with convenience methods
- `apps/web/src/hooks/useKeyboardShortcuts.ts` — Desktop keyboard handler
- `apps/web/src/lib/api.ts` — API client
- `apps/web/src/styles/theme.css` — Design system CSS
- `packages/core/src/index.test.ts` — Core package tests
- `vitest.config.ts` — Test configuration
- `RELEASE_NOTES_V1_DRAFT.md` — This file

### Modified Files
- `packages/core/src/index.ts` — Extended types + layer helpers + snap/alignment
- `apps/api/src/index.ts` — Full API rewrite with CRUD, schema, print, Zod validation
- `apps/web/src/main.tsx` — Updated entry point
- `apps/web/vite.config.ts` — Added React plugin
- `apps/web/package.json` — Added konva, react-konva, plugin-react
- `apps/api/package.json` — Added sharp, multer
- `package.json` — Added vitest, test scripts
- `README.md` — Comprehensive documentation
