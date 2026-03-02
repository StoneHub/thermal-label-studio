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

## Testing on phone

### A) Same Wi-Fi / LAN test (recommended first)

1. Start the shared dev server:

```bash
pnpm dev:share
```

2. In the terminal output, copy the `LAN URL` (example: `http://192.168.50.50:5173`).
3. On your phone (same local network), open that URL in a browser.

### B) Temporary public link (optional)

If `cloudflared` is installed, run:

```bash
pnpm dev:share:public
```

The script prints a temporary `https://...trycloudflare.com` URL that can be opened from any network.

### Verification steps

- Confirm host terminal shows Vite running on `0.0.0.0:5173`.
- From the host machine, open `http://localhost:5173`.
- From phone on same Wi-Fi, open the printed `LAN URL`.
- If using tunnel mode, open the printed `trycloudflare` URL and verify the same page renders.
- Stop sharing with `Ctrl+C` (this also stops the tunnel if running).

### Useful endpoints (API)

- `GET /health`
- `GET /templates/default`
- `POST /render` with a `LabelTemplate` JSON body

## Notes

- `packages/core` currently includes **stubs** for render pipeline (`renderLabelStub`), intended to be replaced with real canvas/TSPL generation.
- `packages/templates` includes shipping-label and sticker-sheet starter JSON templates.
