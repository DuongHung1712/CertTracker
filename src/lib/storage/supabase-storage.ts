import type { SupabaseClient } from "@supabase/supabase-js";
import type { FileStorage } from "@/lib/storage/file-storage";
import type { Database } from "@/types/database";

export const EVIDENCE_BUCKET = "certificates";

/** Pass the signed-in user's client: storage RLS then enforces who may touch which object. */
export function createSupabaseStorage(client: SupabaseClient<Database>, bucket = EVIDENCE_BUCKET): FileStorage {
  return {
    async upload(path, file, contentType) {
      // storage-js ignores `options.contentType` for a Blob/File body (it uses the blob's own
      // `type`, which is whatever the browser claimed). An ArrayBuffer body is sent with the
      // explicit content-type header, so the stored type is the one the caller decided.
      const body = await file.arrayBuffer();
      const { data, error } = await client.storage.from(bucket).upload(path, body, { contentType, upsert: false });
      if (error) throw new Error(error.message);
      return { path: data.path };
    },
    async getSignedUrl(path, expiresInSec) {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInSec);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
    async delete(path) {
      const { error } = await client.storage.from(bucket).remove([path]);
      if (error) throw new Error(error.message);
    },
  };
}
