import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  createLabelWorkspace,
  type LabelDocument,
  type RenderArtifact,
  type WorkspaceCommand,
} from "@tls/core";
import { z } from "zod/v4";

/**
 * The workspace is deliberately created inside the server factory. MCP's
 * stdio helper calls the factory once for each connection, keeping documents
 * isolated to that connection and avoiding process-global label state.
 */
export type LabelWorkspace = ReturnType<typeof createLabelWorkspace>;

const RenameDocumentCommandSchema = z.object({
  type: z.literal("rename-document"),
  name: z.string().min(1),
});

const AddTextCommandSchema = z.object({
  type: z.literal("add-text"),
  elementId: z.string().min(1).optional(),
  text: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  fontSize: z.number().positive().optional(),
  fill: z.string().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.number().positive().optional(),
});

const AddRectangleCommandSchema = z.object({
  type: z.literal("add-rectangle"),
  elementId: z.string().min(1).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().nonnegative().optional(),
  rx: z.number().nonnegative().optional(),
  ry: z.number().nonnegative().optional(),
});

const TextUpdatesSchema = z.object({
  text: z.string().optional(),
  fontSize: z.number().positive().optional(),
  fill: z.string().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.number().positive().optional(),
});

const UpdateTextCommandSchema = z.object({
  type: z.literal("update-text"),
  elementId: z.string().min(1),
  text: z.string().optional(),
  updates: TextUpdatesSchema.optional(),
  patch: TextUpdatesSchema.optional(),
});

const MoveElementCommandSchema = z.object({
  type: z.literal("move-element"),
  elementId: z.string().min(1),
  x: z.number().optional(),
  y: z.number().optional(),
  dx: z.number().optional(),
  dy: z.number().optional(),
});

const RemoveElementCommandSchema = z.object({
  type: z.literal("remove-element"),
  elementId: z.string().min(1),
});

const EditCommandSchema = z.discriminatedUnion("type", [
  RenameDocumentCommandSchema,
  AddTextCommandSchema,
  AddRectangleCommandSchema,
  UpdateTextCommandSchema,
  MoveElementCommandSchema,
  RemoveElementCommandSchema,
]);

const CreateInputSchema = z.object({
  name: z.string().min(1),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  id: z.string().min(1).optional(),
});

const EditInputSchema = z.object({
  documentId: z.string().min(1),
  commands: z.array(EditCommandSchema).min(1).max(100),
});

const PreviewInputSchema = z.object({
  documentId: z.string().min(1),
});

function textResult(text: string, structuredContent: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    structuredContent,
  };
}

function documentSummary(document: LabelDocument) {
  return {
    id: document.id,
    name: document.name,
    size: {
      width: document.size.width,
      height: document.size.height,
    },
    revision: document.revision,
    elementCount: document.elements.length,
  };
}

/** Create one MCP server and one private label workspace for its connection. */
export function createMcpServer(): McpServer {
  const workspace = createLabelWorkspace();
  const server = new McpServer(
    { name: "thermal-label-studio", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    "label_create",
    {
      description: "Create a LabelDocument in this MCP connection's in-memory workspace.",
      inputSchema: CreateInputSchema,
    },
    async (input) => {
      const change = workspace.execute({
        type: "create-document",
        documentId: input.id ?? randomUUID(),
        name: input.name,
        size: {
          width: input.width ?? 812,
          height: input.height ?? 1218,
        },
      });
      const document = change.document;
      const summary = documentSummary(document);
      return textResult(`Created label document ${summary.id} (${summary.name}).`, {
        document: summary,
      });
    },
  );

  server.registerTool(
    "label_edit",
    {
      description:
        "Apply supported edits to a LabelDocument. The server injects documentId into every WorkspaceCommand.",
      inputSchema: EditInputSchema,
    },
    async (input) => {
      let document = workspace.getDocument(input.documentId);
      if (!document) {
        throw new Error(`LabelDocument not found: ${input.documentId}`);
      }

      for (const command of input.commands) {
        const change = workspace.execute({
          ...command,
          documentId: input.documentId,
        } as WorkspaceCommand);
        document = change.document;
      }

      const summary = documentSummary(document);
      return textResult(
        `Applied ${input.commands.length} edit${input.commands.length === 1 ? "" : "s"} to ${summary.id}.`,
        { document: summary, commandCount: input.commands.length },
      );
    },
  );

  server.registerTool(
    "label_preview",
    {
      description: "Render a LabelDocument to an SVG preview artifact.",
      inputSchema: PreviewInputSchema,
    },
    async (input) => {
      const document = workspace.getDocument(input.documentId);
      if (!document) {
        throw new Error(`LabelDocument not found: ${input.documentId}`);
      }

      const artifact = workspace.render(input.documentId);
      const summary = documentSummary(document);
      return textResult(`Rendered SVG preview for ${summary.id} at revision ${summary.revision}.`, {
        document: summary,
        artifact: {
          documentId: artifact.documentId,
          revision: artifact.revision,
          width: artifact.width,
          height: artifact.height,
          mimeType: artifact.mimeType,
          source: artifact.source,
        },
      });
    },
  );

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.error("@tls/mcp listening on stdio");
  serveStdio(createMcpServer);
}
