/** Provider-agnostic file storage (decisions.md #7). */
export interface FileStorage {
  upload(path: string, file: Blob, contentType: string): Promise<{ path: string }>;
  getSignedUrl(path: string, expiresInSec: number): Promise<string>;
  delete(path: string): Promise<void>;
}
