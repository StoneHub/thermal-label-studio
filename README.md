# Thermal Label Studio

Thermal Label Studio is a local label workspace for people and agents. The current rewrite gives both the web review UI and the MCP adapter the same document-editing and SVG preview behavior.

Printer discovery and delivery belong to Fleet. This repository does not open raw printer sockets, submit print jobs, or claim that a physical label printed.

## Current slice

- `packages/core`: canonical `LabelDocument`, Workspace edits, and SVG `RenderArtifact` generation
- `apps/mcp`: local stdio tools for creating, editing, and previewing labels
- `apps/web`: small human review UI using the same Workspace and renderer

The old Konva editor and Express app remain in Git history and the working tree as reference while the rewrite proves its replacement seams. The Express app is not part of the default development command.

## Run the review UI

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

## Run the MCP adapter

```bash
pnpm dev:mcp
```

See `apps/mcp/README.md` for host configuration and proof limits.

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
- `apps/api` is the old local HTTP app and simulated print queue. Start it only with `pnpm dev:legacy-api` when inspecting legacy behavior.

## License

MIT. See [LICENSE](./LICENSE).
