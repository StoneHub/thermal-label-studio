import { describe, expect, it, vi } from "vitest";
import { submitPrintBatch } from "./printBatch";
import type { LabelPrintIntent } from "./printIntent";
const intents = [1, 2, 3].map(n => ({ taskId: `page-${n}` } as LabelPrintIntent));
describe("ordered print batch", () => {
  it("sends each immutable page intent once in order", async () => {
    const submit = vi.fn(async (intent: LabelPrintIntent) => ({ taskId: intent.taskId, accepted: true, state: "accepted" as const, detail: "Accepted" }));
    expect(await submitPrintBatch(intents, submit)).toBe(3);
    expect(submit.mock.calls.map(([intent]) => intent.taskId)).toEqual(["page-1", "page-2", "page-3"]);
  });
  it("stops at uncertainty and never retries or sends remaining pages", async () => {
    const submit = vi.fn().mockResolvedValueOnce({ accepted: true }).mockRejectedValueOnce(new Error("Connection lost"));
    await expect(submitPrintBatch(intents, submit)).rejects.toMatchObject({ acceptedCount: 1, attemptedPage: 2 });
    expect(submit).toHaveBeenCalledTimes(2);
  });
  it("stops on an explicit rejection", async () => {
    const submit = vi.fn().mockResolvedValue({ accepted: false, detail: "Not ready" });
    await expect(submitPrintBatch(intents, submit)).rejects.toThrow(/stopped at page 1/);
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
