import type { LabelPrintIntent, TransportReceipt } from "./printIntent";

export class PrintBatchError extends Error {
  constructor(readonly acceptedCount: number, readonly attemptedPage: number, detail: string) {
    super(`${acceptedCount} earlier label(s) accepted; stopped at page ${attemptedPage}. ${detail} Check the printer before reprinting. Remaining pages were not sent.`);
  }
}

/** Submit a prepared snapshot once, in order. Never retry an uncertain result. */
export async function submitPrintBatch(
  intents: readonly LabelPrintIntent[],
  submit: (intent: LabelPrintIntent) => Promise<TransportReceipt>,
  progress: (index: number) => void = () => {},
): Promise<number> {
  let accepted = 0;
  for (const intent of intents) {
    progress(accepted + 1);
    try {
      const receipt = await submit(intent);
      if (!receipt.accepted) throw new Error(receipt.detail);
      accepted += 1;
    } catch (error) {
      throw new PrintBatchError(accepted, accepted + 1, error instanceof Error ? error.message : "The result is unknown.");
    }
  }
  return accepted;
}
