import type { LabelDocument } from "@tls/core";
import type { ImportedArtwork } from "./artworkImport";
import { initialDocument } from "./editorModel";

/** Each PDF page is its own editable LabelDocument, never a stacked layer. */
export function documentFromArtwork(artwork: ImportedArtwork, id: string): LabelDocument {
  return {
    ...initialDocument,
    id,
    name: artwork.name,
    elements: [{
      id: `${id}-image`, type: "image", source: artwork.dataUrl, alt: artwork.name,
      x: 0, y: 0, width: initialDocument.size.width, height: initialDocument.size.height,
      fit: "cover",
    }],
  };
}
