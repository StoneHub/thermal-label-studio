# Thermal Label Studio

Monorepo scaffold for a 4x6 thermal label editor + API.

## Workspace Layout

- `apps/web` — Vite + React interactive editor starter
- `apps/api` — Express REST API starter
- `packages/core` — shared TypeScript types + render pipeline stubs
- `packages/templates` — starter label templates (JSON)

## Stack

- **Package manager:** pnpm workspaces
- **Language:** TypeScript (ESM)
- **Web app:** React + Vite
- **API:** Express + tsx (dev)

## Quick Start

```bash
pnpm install
pnpm dev
```

This starts all workspace dev scripts in parallel.

### Run apps individually

```bash
pnpm --filter @tls/web dev   # http://localhost:5173
pnpm --filter @tls/api dev   # http://localhost:3001
```

### Build everything

```bash
pnpm build
```

### Useful endpoints (API)

- `GET /health`
- `GET /templates/default`
- `POST /render` with a `LabelTemplate` JSON body

## Notes

- `packages/core` currently includes **stubs** for render pipeline (`renderLabelStub`), intended to be replaced with real canvas/TSPL generation.
- `packages/templates` includes shipping-label and sticker-sheet starter JSON templates.
