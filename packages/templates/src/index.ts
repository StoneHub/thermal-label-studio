import shippingLabel from "./shipping-label.json" with { type: "json" };
import stickerSheet from "./sticker-sheet.json" with { type: "json" };
import type { LabelTemplate } from "@tls/core";

export const starterTemplates: LabelTemplate[] = [
  shippingLabel as LabelTemplate,
  stickerSheet as LabelTemplate
];
