import { getDocumentProxy, renderPageAsImage } from "unpdf";
import { MAX_PAGES, type ExtractRequest } from "@/lib/ai/contract";
import { err, ok, type Result } from "@/lib/result";

/** Long side of a rendered page, in pixels: enough for small print, well inside the provider's per-image limits. */
const MAX_SIDE = 1600;
const MAX_SCALE = 2;
const UNREADABLE = "That PDF could not be read.";

/** The first `maxPages` pages of a PDF as JPEG images. Never throws: a corrupt or empty PDF is a plain message. */
export async function pdfToImages(bytes: Uint8Array, maxPages = MAX_PAGES): Promise<Result<ExtractRequest["pages"]>> {
  try {
    // pdf.js takes ownership of the buffer it is given, so hand it a copy.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const count = Math.min(pdf.numPages, maxPages);
    if (count < 1) return err(UNREADABLE);

    const pages: ExtractRequest["pages"] = [];
    for (let number = 1; number <= count; number++) {
      const { width, height } = (await pdf.getPage(number)).getViewport({ scale: 1 });
      const scale = Math.min(MAX_SCALE, MAX_SIDE / Math.max(width, height));
      const image = await renderPageAsImage(pdf, number, { canvasImport: () => import("@napi-rs/canvas"), scale, format: "jpeg", quality: 0.85 });
      pages.push({ mime: "image/jpeg", bytesBase64: Buffer.from(image).toString("base64") });
    }
    return ok(pages);
  } catch {
    return err(UNREADABLE);
  }
}
