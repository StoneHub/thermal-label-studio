import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyArtworkFile, fitArtworkWithin, importArtwork, importArtworkPages } from "./artworkImport";

const pdfjs = vi.hoisted(() => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: "" },
}));
vi.mock("pdfjs-dist", () => pdfjs);
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "test-pdf-worker.mjs" }));

describe("classifyArtworkFile", () => {
  it.each([
    ["photo.png", "image/png", "image"],
    ["photo.JPG", "", "image"],
    ["clipboard.webp", "image/webp", "image"],
    ["vector.svg", "image/svg+xml", "image"],
    ["document.pdf", "application/pdf", "pdf"],
    ["clipboard", "application/pdf", "pdf"],
  ])("classifies %s", (name, type, expected) => {
    expect(classifyArtworkFile({ name, type })).toBe(expected);
  });

  it("rejects formats outside the browser import set", () => {
    expect(classifyArtworkFile({ name: "notes.txt", type: "text/plain" })).toBe("unsupported");
    expect(classifyArtworkFile({ name: "drawing.bmp", type: "image/bmp" })).toBe("unsupported");
    expect(classifyArtworkFile({ name: "drawing.png", type: "image/bmp" })).toBe("unsupported");
  });
});

describe("importArtworkPages", () => {
  const pdfFile = () => new File(["%PDF-test"], "labels.pdf", { type: "application/pdf" });
  const createPage = (width = 300, height = 200) => ({
    getViewport: vi.fn(({ scale }: { scale: number }) => ({ width: width * scale, height: height * scale })),
    render: vi.fn(() => ({ promise: Promise.resolve() })),
    cleanup: vi.fn(),
  });
  type TestPage = ReturnType<typeof createPage>;
  type TestCanvas = {
    width: number;
    height: number;
    getContext: ReturnType<typeof vi.fn>;
    toDataURL: ReturnType<typeof vi.fn>;
  };
  let canvases: TestCanvas[];
  let context: { drawImage: ReturnType<typeof vi.fn> };

  const loadPdf = (pages: TestPage[], pageCount = pages.length) => {
    const documentProxy = {
      numPages: pageCount,
      getPage: vi.fn(async (number: number) => pages[number - 1]),
      cleanup: vi.fn(async () => undefined),
    };
    const loadingTask = {
      promise: Promise.resolve(documentProxy),
      destroy: vi.fn(async () => undefined),
    };
    pdfjs.getDocument.mockReturnValue(loadingTask);
    return { documentProxy, loadingTask };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    canvases = [];
    context = { drawImage: vi.fn() };
    vi.stubGlobal("document", {
      createElement: vi.fn((tag: string) => {
        expect(tag).toBe("canvas");
        const canvas: TestCanvas = {
          width: 0,
          height: 0,
          getContext: vi.fn(() => context),
          toDataURL: vi.fn(() => `data:image/png;base64,page-${canvases.indexOf(canvas) + 1}`),
        };
        canvases.push(canvas);
        return canvas;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("imports every PDF page in order with its own dimensions and metadata", async () => {
    const pages = [createPage(300, 200), createPage(200, 400), createPage(100, 100)];
    const { documentProxy, loadingTask } = loadPdf(pages);

    const artwork = await importArtworkPages(pdfFile());

    expect(artwork).toEqual([
      { name: "labels.pdf — page 1", dataUrl: "data:image/png;base64,page-1", width: 600, height: 400, sourceKind: "pdf-page", pageNumber: 1, pageCount: 3 },
      { name: "labels.pdf — page 2", dataUrl: "data:image/png;base64,page-2", width: 400, height: 800, sourceKind: "pdf-page", pageNumber: 2, pageCount: 3 },
      { name: "labels.pdf — page 3", dataUrl: "data:image/png;base64,page-3", width: 200, height: 200, sourceKind: "pdf-page", pageNumber: 3, pageCount: 3 },
    ]);
    expect(documentProxy.getPage.mock.calls).toEqual([[1], [2], [3]]);
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe("test-pdf-worker.mjs");
    expect(pdfjs.getDocument).toHaveBeenCalledWith({ data: expect.any(Uint8Array) });
    for (const page of pages) expect(page.cleanup).toHaveBeenCalledOnce();
    for (const canvas of canvases) {
      expect(canvas.toDataURL).toHaveBeenCalledWith("image/png");
      expect([canvas.width, canvas.height]).toEqual([0, 0]);
    }
    expect(documentProxy.cleanup).toHaveBeenCalledOnce();
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("does not start another page until the previous render and cleanup finish", async () => {
    const pages = [createPage(), createPage()];
    let finishFirstRender!: () => void;
    pages[0].render.mockReturnValue({ promise: new Promise<void>((resolve) => { finishFirstRender = resolve; }) });
    const { documentProxy } = loadPdf(pages);

    const importing = importArtworkPages(pdfFile());
    await vi.waitFor(() => expect(pages[0].render).toHaveBeenCalledOnce());
    expect(documentProxy.getPage.mock.calls).toEqual([[1]]);
    expect(pages[1].render).not.toHaveBeenCalled();
    finishFirstRender();
    await importing;
    expect(pages[0].cleanup.mock.invocationCallOrder[0]).toBeLessThan(pages[1].render.mock.invocationCallOrder[0]);
  });

  it("keeps single-page PDF filenames and caps the raster dimensions", async () => {
    loadPdf([createPage(8000, 4000)]);
    await expect(importArtworkPages(pdfFile())).resolves.toEqual([
      expect.objectContaining({ name: "labels.pdf", width: 4096, height: 2048, pageNumber: 1, pageCount: 1 }),
    ]);
  });

  it("keeps the compatibility API limited to the first page", async () => {
    const { documentProxy } = loadPdf([createPage()], 100);
    await expect(importArtwork(pdfFile())).resolves.toMatchObject({ name: "labels.pdf", sourceKind: "pdf-page", pageNumber: 1, pageCount: 100 });
    expect(documentProxy.getPage.mock.calls).toEqual([[1]]);
  });

  it("returns an image as one item without loading PDF.js", async () => {
    const bitmap = { width: 300, height: 100, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
    const file = new File(["png"], "photo.png", { type: "image/png" });

    await expect(importArtworkPages(file)).resolves.toEqual([
      { name: "photo.png", dataUrl: "data:image/png;base64,page-1", width: 300, height: 100, sourceKind: "image" },
    ]);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 300, 100);
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(pdfjs.getDocument).not.toHaveBeenCalled();
  });

  it("rejects empty and unsupported files before loading PDF.js", async () => {
    await expect(importArtworkPages(new File([], "empty.pdf"))).rejects.toThrow("That file is empty.");
    await expect(importArtworkPages(new File(["text"], "notes.txt", { type: "text/plain" }))).rejects.toThrow("is not supported");
    expect(pdfjs.getDocument).not.toHaveBeenCalled();
  });

  it("rejects PDFs above the file-size limit before reading their bytes", async () => {
    const file = pdfFile();
    Object.defineProperty(file, "size", { value: 32 * 1024 * 1024 + 1 });
    const readBytes = vi.spyOn(file, "arrayBuffer");
    await expect(importArtworkPages(file)).rejects.toThrow("32 MiB file-size limit");
    expect(readBytes).not.toHaveBeenCalled();
    expect(pdfjs.getDocument).not.toHaveBeenCalled();
  });

  it("rejects PDFs above the page limit without partially importing them", async () => {
    const { documentProxy, loadingTask } = loadPdf([], 51);
    await expect(importArtworkPages(pdfFile())).rejects.toThrow("51 pages; the import limit is 50");
    expect(documentProxy.getPage).not.toHaveBeenCalled();
    expect(canvases).toHaveLength(0);
    expect(documentProxy.cleanup).toHaveBeenCalledOnce();
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("accepts exactly 50 small pages", async () => {
    const pages = Array.from({ length: 50 }, () => createPage(10, 10));
    const { loadingTask } = loadPdf(pages);
    const artwork = await importArtworkPages(pdfFile());
    expect(artwork).toHaveLength(50);
    expect(artwork[49]).toMatchObject({ pageNumber: 50, pageCount: 50 });
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("bounds total raster memory even below the page-count limit", async () => {
    const pages = Array.from({ length: 5 }, () => createPage(4096, 4096));
    const { documentProxy, loadingTask } = loadPdf(pages);
    await expect(importArtworkPages(pdfFile())).rejects.toThrow("64-megapixel raster memory limit");
    expect(canvases).toHaveLength(3);
    expect(documentProxy.getPage.mock.calls).toEqual([[1], [2], [3], [4]]);
    expect(pages[3].render).not.toHaveBeenCalled();
    expect(pages[3].cleanup).toHaveBeenCalledOnce();
    expect(pages[4].cleanup).not.toHaveBeenCalled();
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("bounds the retained encoded raster data", async () => {
    const pages = [createPage(), createPage()];
    const { loadingTask } = loadPdf(pages);
    pages.forEach((page) => page.render.mockImplementation(() => {
      canvases.at(-1)!.toDataURL.mockReturnValue("x".repeat(33 * 1024 * 1024));
      return { promise: Promise.resolve() };
    }));
    await expect(importArtworkPages(pdfFile())).rejects.toThrow("raster data memory limit");
    for (const page of pages) expect(page.cleanup).toHaveBeenCalledOnce();
    for (const canvas of canvases) expect([canvas.width, canvas.height]).toEqual([0, 0]);
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("rejects PDFs without pages and destroys their worker", async () => {
    const { documentProxy, loadingTask } = loadPdf([]);
    await expect(importArtworkPages(pdfFile())).rejects.toThrow("does not contain a page");
    expect(documentProxy.getPage).not.toHaveBeenCalled();
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("rejects unusable page dimensions before creating a canvas", async () => {
    const page = createPage(0, 100);
    const { loadingTask } = loadPdf([page]);
    await expect(importArtworkPages(pdfFile())).rejects.toThrow("PDF page width and height must be positive finite numbers");
    expect(canvases).toHaveLength(0);
    expect(page.cleanup).toHaveBeenCalledOnce();
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("cleans all acquired resources after a later page fails and preserves the render error", async () => {
    const pages = [createPage(), createPage(), createPage()];
    pages[1].render.mockImplementation(() => ({ promise: Promise.reject(new Error("second page is corrupt")) }));
    pages[1].cleanup.mockImplementation(() => { throw new Error("page cleanup failed"); });
    const { documentProxy, loadingTask } = loadPdf(pages);
    documentProxy.cleanup.mockRejectedValue(new Error("document cleanup failed"));
    loadingTask.destroy.mockRejectedValue(new Error("worker teardown failed"));

    await expect(importArtworkPages(pdfFile())).rejects.toThrow("The PDF could not be rendered. second page is corrupt");
    expect(documentProxy.getPage.mock.calls).toEqual([[1], [2]]);
    expect(pages[0].cleanup).toHaveBeenCalledOnce();
    expect(pages[1].cleanup).toHaveBeenCalledOnce();
    expect(pages[2].render).not.toHaveBeenCalled();
    for (const canvas of canvases) expect([canvas.width, canvas.height]).toEqual([0, 0]);
    expect(documentProxy.cleanup).toHaveBeenCalledOnce();
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("destroys the loading task when PDF parsing fails", async () => {
    const destroy = vi.fn(async () => undefined);
    pdfjs.getDocument.mockImplementation(() => ({ promise: Promise.reject(new Error("invalid PDF")), destroy }));
    await expect(importArtworkPages(pdfFile())).rejects.toThrow("The PDF could not be rendered. invalid PDF");
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("cleans the document and worker when fetching a later page fails", async () => {
    const page = createPage();
    const { documentProxy, loadingTask } = loadPdf([page], 2);
    documentProxy.getPage.mockResolvedValueOnce(page).mockRejectedValueOnce(new Error("page fetch failed"));
    await expect(importArtworkPages(pdfFile())).rejects.toThrow("page fetch failed");
    expect(canvases).toHaveLength(1);
    expect(page.cleanup).toHaveBeenCalledOnce();
    expect([canvases[0].width, canvases[0].height]).toEqual([0, 0]);
    expect(documentProxy.cleanup).toHaveBeenCalledOnce();
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("releases the page and canvas when the browser cannot create a 2D context", async () => {
    const page = createPage();
    const { loadingTask } = loadPdf([page]);
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => null) };
    vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
    await expect(importArtworkPages(pdfFile())).rejects.toThrow("could not create a 2D canvas");
    expect(page.render).not.toHaveBeenCalled();
    expect(page.cleanup).toHaveBeenCalledOnce();
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("releases the page and canvas if PNG encoding fails", async () => {
    const page = createPage();
    const { loadingTask } = loadPdf([page]);
    page.render.mockImplementation(() => {
      canvases[0].toDataURL.mockImplementation(() => { throw new Error("encoding failed"); });
      return { promise: Promise.resolve() };
    });
    await expect(importArtworkPages(pdfFile())).rejects.toThrow("encoding failed");
    expect(page.cleanup).toHaveBeenCalledOnce();
    expect([canvases[0].width, canvases[0].height]).toEqual([0, 0]);
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });
});

describe("fitArtworkWithin", () => {
  it("fits a wide image inside a portrait label and centers it", () => {
    expect(fitArtworkWithin({ width: 1600, height: 900 }, { width: 800, height: 1200 }, 40)).toEqual({
      x: 40,
      y: 397.5,
      width: 720,
      height: 405,
    });
  });

  it("supports asymmetric margins", () => {
    expect(
      fitArtworkWithin(
        { width: 100, height: 100 },
        { width: 500, height: 300 },
        { top: 10, right: 20, bottom: 30, left: 40 }
      )
    ).toEqual({ x: 130, y: 10, width: 260, height: 260 });
  });

});
