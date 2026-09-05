import { afterEach, describe, expect, it, vi } from "vitest";
import { packMonochromePbm, submitLabelPrintIntent, type LabelPrintIntent } from "./printIntent";

function pixel(r: number, g: number, b: number, a = 255): number[] {
  return [r, g, b, a];
}

describe("packMonochromePbm", () => {
  it("packs one-bit rows with a stable black threshold", () => {
    const rgba = new Uint8ClampedArray([
      ...pixel(0, 0, 0),
      ...pixel(255, 255, 255),
      ...pixel(160, 160, 160),
      ...pixel(168, 168, 168),
      ...pixel(255, 0, 0),
      ...pixel(0, 255, 0),
      ...pixel(0, 0, 255),
      ...pixel(0, 0, 0, 0),
    ]);

    const packed = packMonochromePbm(rgba, 8, 1);
    const header = new TextEncoder().encode("P4\n8 1\n");

    expect(Array.from(packed.bytes.slice(0, header.length))).toEqual(Array.from(header));
    expect(packed.bytes.at(-1)).toBe(0b10101110);
    expect(packed.blackPixelCount).toBe(5);
  });

  it("rejects mismatched pixel buffers", () => {
    expect(() => packMonochromePbm(new Uint8ClampedArray(4), 2, 1)).toThrow(/does not match/);
  });
});


afterEach(() => vi.unstubAllGlobals());
describe("single print submission", () => {
  const intent: LabelPrintIntent = {
    taskId: "one-attempt", maxAttempts: 1, printerProfileId: "phomemo-pm241bt-4x6",
    artifact: { documentId: "label", revision: 1, width: 800, height: 1200,
      mimeType: "image/x-portable-bitmap", sha256: "test-hash", blackPixelCount: 1, dataBase64: "test-bitmap" },
  };
  it("does not retry an uncertain network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(submitLabelPrintIntent(intent)).rejects.toThrow(/result is unknown/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("reports an unreadable receipt without claiming rejection or retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("broken receipt"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(submitLabelPrintIntent(intent)).rejects.toThrow(/unreadable receipt/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("returns transport acceptance for a valid receipt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      taskId: intent.taskId, accepted: true, state: "accepted", detail: "Accepted once",
    }))));
    expect(await submitLabelPrintIntent(intent)).toMatchObject({ accepted: true, taskId: intent.taskId });
  });
});
