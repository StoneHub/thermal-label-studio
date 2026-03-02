import shippingLabel from "./shipping-label.json";
import stickerSheet from "./sticker-sheet.json";
import type { LabelTemplate } from "@tls/core";

export const starterTemplates: LabelTemplate[] = [
  shippingLabel as LabelTemplate,
  stickerSheet as LabelTemplate
];
