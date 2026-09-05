import { createLabelWorkspace, type LabelDocument, type WorkspaceCommand } from "@tls/core";

/** A bounded edit history. A multi-command gesture commits or fails as one edit. */
export function createEditorSession(initial: LabelDocument) {
  let workspace = createLabelWorkspace([initial]);
  const past: LabelDocument[] = [];
  const future: LabelDocument[] = [];
  const current = () => workspace.getDocument(initial.id)!;
  const restore = (snapshot: LabelDocument) => {
    workspace = createLabelWorkspace([{ ...snapshot, revision: current().revision + 1 }]);
    return current();
  };
  return {
    current,
    render: () => workspace.render(initial.id),
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    execute(commands: WorkspaceCommand | readonly WorkspaceCommand[]) {
      const before = current();
      const next = createLabelWorkspace([before]);
      for (const command of Array.isArray(commands) ? commands : [commands]) next.execute(command);
      past.push(before);
      if (past.length > 40) past.shift();
      future.length = 0;
      workspace = next;
      return current();
    },
    undo() {
      const snapshot = past.pop();
      if (!snapshot) return current();
      future.push(current());
      return restore(snapshot);
    },
    redo() {
      const snapshot = future.pop();
      if (!snapshot) return current();
      past.push(current());
      return restore(snapshot);
    },
  };
}
