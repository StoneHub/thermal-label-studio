/**
 * A small, deterministic text wrapper for label rendering.
 *
 * Labels are rendered in the browser and later rasterized from the exact same
 * SVG artifact. The renderer can inject browser font metrics, while this
 * deterministic approximation keeps non-browser callers and tests usable.
 */
export type LabelTextMeasure = (
  value: string,
  fontSize: number,
  fontWeight?: number,
  letterSpacing?: number,
  fontFamily?: string,
) => number;

export const measureLabelText: LabelTextMeasure = (
  value: string,
  fontSize: number,
  fontWeight = 400,
  letterSpacing = 0,
  _fontFamily,
): number => {
  const weightScale = fontWeight >= 600 ? 1.06 : 1;
  let width = 0;
  for (const character of value) {
    const glyphScale = character === " "
      ? 0.33
      : "ilI.,'`!|:;".includes(character)
        ? 0.28
        : "MW@#%&".includes(character)
          ? 0.88
          : 0.56;
    width += fontSize * glyphScale * weightScale;
  }
  return width + Math.max(0, value.length - 1) * letterSpacing;
};

const wrapLongWord = (
  word: string,
  maxWidth: number,
  fontSize: number,
  fontWeight: number,
  letterSpacing: number,
  fontFamily: string | undefined,
  measureText: LabelTextMeasure,
): string[] => {
  const pieces: string[] = [];
  let piece = "";
  for (const character of word) {
    const candidate = piece + character;
    if (piece && measureText(candidate, fontSize, fontWeight, letterSpacing, fontFamily) > maxWidth) {
      pieces.push(piece);
      piece = character;
    } else {
      piece = candidate;
    }
  }
  if (piece || pieces.length === 0) pieces.push(piece);
  return pieces;
};

const wrapParagraph = (
  paragraph: string,
  maxWidth: number,
  fontSize: number,
  fontWeight: number,
  letterSpacing: number,
  fontFamily: string | undefined,
  measureText: LabelTextMeasure,
): string[] => {
  if (paragraph.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
    const pieces = measureText(word, fontSize, fontWeight, letterSpacing, fontFamily) > maxWidth
      ? wrapLongWord(word, maxWidth, fontSize, fontWeight, letterSpacing, fontFamily, measureText)
      : [word];
    for (const piece of pieces) {
      const candidate = line ? `${line} ${piece}` : piece;
      if (line && measureText(candidate, fontSize, fontWeight, letterSpacing, fontFamily) > maxWidth) {
        lines.push(line);
        line = piece;
      } else {
        line = candidate;
      }
    }
  }
  if (line || lines.length === 0) lines.push(line);
  return lines;
};

/** Wrap text while preserving every explicit newline, including blank lines. */
export const wrapLabelText = (
  text: string,
  maxWidth: number,
  fontSize: number,
  fontWeight = 400,
  letterSpacing = 0,
  fontFamily?: string,
  measureText: LabelTextMeasure = measureLabelText,
): string[] => {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return text.split("\n");
  const paragraphs = text.split("\n");
  return paragraphs.flatMap((paragraph) => wrapParagraph(
    paragraph,
    maxWidth,
    fontSize,
    fontWeight,
    letterSpacing,
    fontFamily,
    measureText,
  ));
};
