import { loadImage } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { pdfToImages } from "@/lib/ai/pdf-pages";

/** A valid minimal PDF with `pages` pages, each with a line of text. Offsets for the xref table are computed, not guessed. */
function makePdf(pages: number, box = "0 0 595 842"): Uint8Array {
  const objects: string[] = [];
  const pageIds = Array.from({ length: pages }, (_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pageIds.forEach((id, i) => {
    const text = `BT /F1 36 Tf 40 400 Td (Certificate page ${i + 1}) Tj ET`;
    objects[id] = `<< /Type /Page /Parent 2 0 R /MediaBox [${box}] /Contents ${id + 1} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    objects[id + 1] = `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

const dimensions = async (base64: string) => {
  const image = await loadImage(Buffer.from(base64, "base64"));
  return { width: image.width, height: image.height };
};

describe("pdfToImages", () => {
  it("renders a 3-page PDF as 3 JPEG images with a long side of at most 1600 px", async () => {
    const result = await pdfToImages(makePdf(3));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(3);
    for (const page of result.data) {
      expect(page.mime).toBe("image/jpeg");
      const { width, height } = await dimensions(page.bytesBase64);
      expect(Math.max(width, height)).toBeLessThanOrEqual(1600);
      expect(Math.min(width, height)).toBeGreaterThan(100);
    }
  }, 30_000);

  it("renders only the first 3 pages of a 5-page PDF", async () => {
    const result = await pdfToImages(makePdf(5));
    expect(result.ok && result.data).toHaveLength(3);
  }, 30_000);

  it("scales a very large page down to the 1600 px limit", async () => {
    const result = await pdfToImages(makePdf(1, "0 0 3000 2000"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { width, height } = await dimensions(result.data[0].bytesBase64);
    expect(Math.max(width, height)).toBeLessThanOrEqual(1600);
  }, 30_000);

  it("refuses a corrupt PDF with a plain message", async () => {
    const result = await pdfToImages(new TextEncoder().encode("%PDF-1.4\nthis is not a pdf"));
    expect(result).toEqual({ ok: false, error: "That PDF could not be read." });
  }, 30_000);

  it("refuses a PDF with no pages", async () => {
    const result = await pdfToImages(makePdf(0));
    expect(result).toEqual({ ok: false, error: "That PDF could not be read." });
  }, 30_000);
});
