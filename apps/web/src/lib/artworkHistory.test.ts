import { describe, expect, it, vi } from "vitest";
import {
  listArtworkHistory,
  loadArtworkSource,
  saveArtworkSource,
  type ArtworkHistoryItem,
} from "./artworkHistory";

const item: ArtworkHistoryItem = {
  id: "a".repeat(64),
  name: "shipping label.png",
  mimeType: "image/png",
  size: 42,
  uploadedAt: "2026-09-01T01:02:03+00:00",
  sourceUrl: `/api/artwork/${"a".repeat(64)}`,
};

describe("artwork history", () => {
  it("lists only valid original-upload records", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({
      items: [item, { ...item, id: "not-a-digest" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    await expect(listArtworkHistory(request)).resolves.toEqual([item]);
    expect(request).toHaveBeenCalledWith("/api/artwork", { cache: "no-store" });
  });

  it("saves the original bytes and encoded filename", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ item, created: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }));
    const file = new File(["original"], item.name, { type: item.mimeType });

    await expect(saveArtworkSource(file, request)).resolves.toEqual(item);
    expect(request).toHaveBeenCalledWith("/api/artwork", expect.objectContaining({
      method: "POST",
      body: file,
      headers: {
        "content-type": "image/png",
        "x-artwork-name": "shipping%20label.png",
      },
    }));
  });

  it("loads a saved source as a file for re-editing", async () => {
    const request = vi.fn(async () => new Response("original", {
      status: 200,
      headers: { "content-type": "image/png" },
    }));

    const file = await loadArtworkSource(item, request);
    expect(file.name).toBe(item.name);
    expect(file.type).toBe(item.mimeType);
    expect(await file.text()).toBe("original");
  });
});
