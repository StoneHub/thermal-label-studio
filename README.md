# Thermal Label Studio

Thermal Label Studio is a local label editor for people and software agents. The web app supports direct canvas editing, while the MCP adapter exposes the same document and rendering core to other software.

Printer discovery and delivery belong to Fleet. This repository does not open raw printer sockets, create PrintIntents, or claim that a physical label printed.

## Current slice

- `packages/core`: canonical `LabelDocument`, Workspace edits, and SVG `RenderArtifact` generation
- `apps/mcp`: local stdio tools for creating, editing, and previewing labels
- `apps/web`: human editor with direct dragging, element copy/paste, and image or PDF import

The old Konva editor and Express app remain in Git history and the working tree as reference while the rewrite proves its replacement seams. The Express app is not part of the default development command.

Both adapters currently keep their own in-memory session. MCP edits do not appear automatically in the web editor yet.

## Run the label editor

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

## Run the MCP adapter

```bash
pnpm dev:mcp
```

See `apps/mcp/README.md` for local client configuration and current boundaries.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Domain and agent instructions

- `CONTEXT.md` owns domain terms.
- `AGENTS.md` points agents to the GitHub issue workflow, triage labels, and domain rules.
- `docs/adr/` is reserved for decisions that meet the repository's ADR threshold.

## Legacy reference

- `PLAN.md` describes the retired OFFNOVA and OpenClaw direction.
- `RELEASE_NOTES_V1_DRAFT.md` describes the pre-rewrite editor.
- `apps/api` is retained source reference and excluded from the default development, build, and typecheck commands.

## License

MIT. See [LICENSE](./LICENSE).
