import { LABEL_PRINTER_PROFILE } from "./printIntent";

export interface PrinterStatus { ready: boolean; detail: string }

export async function readPrinterStatus(): Promise<PrinterStatus> {
  const response = await fetch("./api/status", { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Printer status is unavailable. Check the Pi connection.");
  const body = await response.json().catch(() => {
    throw new Error("Printer service is unavailable at this address. Open the editor on the Pi to print.");
  });
  if (body?.service !== "fleet-print-node" || body?.printerProfileId !== LABEL_PRINTER_PROFILE.id
    || typeof body?.label?.ready !== "boolean" || typeof body?.label?.detail !== "string") {
    throw new Error("This address is not the expected label print node.");
  }
  return {
    ready: body.label.ready === true && body.label.configured === true && body.label.usbPresent === true,
    detail: body.label.detail,
  };
}
