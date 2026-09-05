import { afterEach, describe, expect, it, vi } from "vitest";
import { readPrinterStatus } from "./printerStatus";

const ready = { service: "fleet-print-node", printerProfileId: "phomemo-pm241bt-4x6", label: { ready: true, configured: true, usbPresent: true, detail: "Ready" } };
afterEach(() => vi.unstubAllGlobals());
function respond(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}
describe("printer readiness", () => {
  it("accepts the fixed printer only when configured and USB-present", async () => {
    respond(ready);
    expect((await readPrinterStatus()).ready).toBe(true);
    respond({ ...ready, label: { ...ready.label, usbPresent: false } });
    expect((await readPrinterStatus()).ready).toBe(false);
  });
  it("rejects a different service, profile, or malformed response", async () => {
    for (const body of [{}, null, { ...ready, service: "other" }, { ...ready, printerProfileId: "other" }]) {
      respond(body);
      await expect(readPrinterStatus()).rejects.toThrow(/expected label print node/);
    }
  });
  it("reports a failed connection", async () => {
    respond({}, 503);
    await expect(readPrinterStatus()).rejects.toThrow(/Pi connection/);
  });
});
