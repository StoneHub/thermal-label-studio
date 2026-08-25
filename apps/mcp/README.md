# @tls/mcp

Local stdio MCP adapter for Thermal Label Studio. It exposes the editable
label workspace to an MCP client without exposing printer or Fleet operations.

## Setup

Build the workspace dependencies and adapter from the repository root:

```bash
pnpm --filter @tls/core build
pnpm --filter @tls/mcp build
```

The adapter requires Node.js 20 or newer. To run it directly during local
development:

```bash
pnpm --filter @tls/mcp dev
```

An MCP client can configure the built server as a local stdio command:

```json
{
  "mcpServers": {
    "thermal-label-studio": {
      "command": "node",
      "args": ["/absolute/path/to/apps/mcp/dist/index.js"]
    }
  }
}
```

The server registers exactly three tools:

- `label_create` creates a `LabelDocument`.
- `label_edit` applies the supported `WorkspaceCommand` variants
  `rename-document`, `add-text`, `update-text`, `move-element`, and
  `remove-element`. The server adds the target `documentId` to each command.
- `label_preview` returns document metadata and the SVG source from a
  `RenderArtifact`.

Readiness text is written to stderr. stdout is reserved for MCP protocol
traffic.

## Proof boundary

The workspace is session-memory only: documents disappear when the MCP
connection ends. The SVG returned by `label_preview` is artifact/preview proof
for a document revision. This adapter does not submit PrintIntents, contact a
printer, provide TransportReceipts, or establish PhysicalObservation proof.
