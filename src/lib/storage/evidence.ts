export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;
export const EVIDENCE_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

export type EvidenceMime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

const EXTENSION: Record<EvidenceMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((byte, i) => bytes[offset + i] === byte);

/** Decide the type from the file's first bytes. `File.type` is whatever the browser (or an attacker) says. */
export function sniffEvidenceType(bytes: Uint8Array): EvidenceMime | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** The user's file name is deliberately not part of the key: no sanitising, no traversal, no collisions. */
export function evidencePath(memberId: string, recordId: string, mime: EvidenceMime, now: number): string {
  return `${memberId}/${recordId}/${now}.${EXTENSION[mime]}`;
}
