import { describe, expect, it } from "vitest";
import { evidencePath, sniffEvidenceType } from "@/lib/storage/evidence";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

describe("sniffEvidenceType", () => {
  it("recognises the four accepted formats by their magic bytes", () => {
    expect(sniffEvidenceType(ascii("%PDF-1.7\n"))).toBe("application/pdf");
    expect(sniffEvidenceType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffEvidenceType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffEvidenceType(ascii("RIFF0000WEBPVP8 "))).toBe("image/webp");
  });

  it("rejects a renamed file, whatever the browser claimed", () => {
    expect(sniffEvidenceType(ascii("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffEvidenceType(ascii("PK\u0003\u0004 docx"))).toBeNull();
    expect(sniffEvidenceType(ascii("RIFF0000WAVEfmt "))).toBeNull();
  });

  it("rejects empty and truncated input", () => {
    expect(sniffEvidenceType(bytes())).toBeNull();
    expect(sniffEvidenceType(bytes(0xff, 0xd8))).toBeNull();
  });
});

describe("evidencePath", () => {
  it("is member/record/timestamp.ext and never contains the uploaded file name", () => {
    expect(evidencePath("m-1", "r-1", "application/pdf", 1700000000000)).toBe("m-1/r-1/1700000000000.pdf");
    expect(evidencePath("m-1", "r-1", "image/jpeg", 1)).toBe("m-1/r-1/1.jpg");
  });
});
