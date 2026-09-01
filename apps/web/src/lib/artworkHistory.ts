export type ArtworkHistoryItem = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  sourceUrl: string;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function isArtworkHistoryItem(value: unknown): value is ArtworkHistoryItem {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string"
    && /^[0-9a-f]{64}$/.test(candidate.id)
    && typeof candidate.name === "string"
    && candidate.name.length > 0
    && typeof candidate.mimeType === "string"
    && (candidate.mimeType.startsWith("image/") || candidate.mimeType === "application/pdf")
    && typeof candidate.size === "number"
    && Number.isSafeInteger(candidate.size)
    && candidate.size > 0
    && typeof candidate.uploadedAt === "string"
    && typeof candidate.sourceUrl === "string"
    && candidate.sourceUrl === `/api/artwork/${candidate.id}`;
}

async function responseDetail(response: Response, fallback: string): Promise<string> {
  try {
    const value = await response.json() as { detail?: unknown };
    return typeof value.detail === "string" ? value.detail : fallback;
  } catch {
    return fallback;
  }
}

export async function listArtworkHistory(fetcher: Fetcher = fetch): Promise<ArtworkHistoryItem[]> {
  const response = await fetcher("/api/artwork", { cache: "no-store" });
  if (!response.ok) throw new Error(await responseDetail(response, "Upload history is unavailable."));
  const value = await response.json() as { items?: unknown };
  return Array.isArray(value.items) ? value.items.filter(isArtworkHistoryItem) : [];
}

export async function saveArtworkSource(file: File, fetcher: Fetcher = fetch): Promise<ArtworkHistoryItem> {
  const response = await fetcher("/api/artwork", {
    method: "POST",
    body: file,
    headers: {
      "content-type": file.type,
      "x-artwork-name": encodeURIComponent(file.name),
    },
  });
  if (!response.ok) throw new Error(await responseDetail(response, "The original upload could not be saved."));
  const value = await response.json() as { item?: unknown };
  if (!isArtworkHistoryItem(value.item)) throw new Error("The print node returned an invalid upload record.");
  return value.item;
}

export async function loadArtworkSource(item: ArtworkHistoryItem, fetcher: Fetcher = fetch): Promise<File> {
  const response = await fetcher(item.sourceUrl, { cache: "force-cache" });
  if (!response.ok) throw new Error(await responseDetail(response, "That original upload is unavailable."));
  const source = await response.blob();
  return new File([source], item.name, { type: item.mimeType });
}
