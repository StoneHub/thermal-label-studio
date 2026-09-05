# Thermal Label Studio

Thermal Label Studio is a local label editor for people and software agents. The web app supports direct canvas editing, while the MCP adapter exposes the same document and rendering core to other software.

Printer discovery and delivery belong to Fleet. The web app can prepare one fixed `PrintIntent` for Fleet's Phomemo PM-241-BT adapter. This repository does not open raw printer sockets or claim that a physical label printed.

## Current slice

- `packages/core`: canonical `LabelDocument`, Workspace edits, and SVG `RenderArtifact` generation
- `apps/mcp`: local stdio tools for creating, editing, and previewing labels
- `apps/web`: static human editor with direct dragging, deterministic centered crop or whole-image fit, quarter-turn rotation, element copy/paste, image or PDF import, and one-attempt `PrintIntent` preparation

The old Konva editor and Express app remain in Git history and the working tree as reference while the rewrite proves its replacement seams. The Express app is not part of the default development command.

Both adapters currently keep their own in-memory session. MCP edits do not appear automatically in the web editor yet.

## Run the label editor

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

The production web build uses relative assets and system fonts. It can be served as static files by the Pi print node without running Node.js on the Pi.

## Editing and printing

- Undo and redo up to 40 edits using the toolbar or Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z. Framing and rotation each count as one edit. Edit history lasts for the current browser session.
- The printer connection bar checks the fixed Pi adapter when the editor opens. Refresh it after reconnecting the Pi or printer. Printing checks readiness again before preparing a label.
- Print results remain visible until dismissed, including on phones. An interrupted request is never retried automatically; check the printer before submitting again.
- The standalone development server supports editing. Printing and saved uploads require Fleet's Pi service at the same origin.

## Run the MCP adapter

```bash
pnpm dev:mcp
```

See `apps/mcp/README.md` for local client configuration and current boundaries.

## Verification

```bash
pnpm build
pnpm typecheck
pnpm test
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
