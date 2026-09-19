import { describe, expect, it } from "vitest";
import { renderLabelDocument, type LabelDocument } from "./index";
import { measureLabelText, wrapLabelText } from "./textWrap";

describe("label text wrapping", () => {
  it("wraps at the element width and preserves explicit newlines", () => {
    expect(wrapLabelText("one two three\n\nfour", 70, 20)).toEqual([
      "one",
      "two",
      "three",
      "",
      "four",
    ]);
  });

  it("breaks a word that is wider than the text box", () => {
    const lines = wrapLabelText("SUPERCALIFRAGILISTIC", 60, 20);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => measureLabelText(line, 20) <= 60)).toBe(true);
  });

  it("uses the same wrapped lines in the render artifact", () => {
    const document: LabelDocument = {
      schemaVersion: 1,
      id: "wrapped-label",
      name: "Wrapped",
      revision: 1,
      size: { width: 200, height: 120 },
      elements: [{
        id: "copy",
        type: "text",
        x: 10,
        y: 10,
        width: 70,
        height: 100,
        text: "one two",
        fontSize: 20,
      }],
    };
    const source = renderLabelDocument(document).source;
    expect(source).toContain('<tspan x="10" y="30">one</tspan>');
    expect(source).toContain('<tspan x="10" y="54">two</tspan>');
    expect(source).toContain('font-family="Arial, sans-serif"');
  });

  it("keeps explicit blank lines in the rendered baseline sequence", () => {
    const document: LabelDocument = {
      schemaVersion: 1,
      id: "blank-lines",
      name: "Blank lines",
      revision: 1,
      size: { width: 200, height: 160 },
      elements: [{
        id: "copy",
        type: "text",
        x: 10,
        y: 10,
        width: 180,
        height: 140,
        text: "First line\n\nThird line",
        fontSize: 20,
      }],
    };
    const source = renderLabelDocument(document).source;
    expect(source).toContain('<tspan x="10" y="30">First line</tspan>');
    expect(source).toContain('<tspan x="10" y="54"></tspan>');
    expect(source).toContain('<tspan x="10" y="78">Third line</tspan>');
  });

  it("accepts browser-provided font measurements", () => {
    const browserMeasure = (value: string): number => value.length * 20;
    expect(wrapLabelText("aa b", 45, 20, 400, 0, "Arial", browserMeasure)).toEqual(["aa", "b"]);
  });
});
