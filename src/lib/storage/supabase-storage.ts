import type { SupabaseClient } from "@supabase/supabase-js";
import type { FileStorage } from "@/lib/storage/file-storage";
import type { Database } from "@/types/database";

export const EVIDENCE_BUCKET = "certificates";

/** Pass the signed-in user's client: storage RLS then enforces who may touch which object. */
export function createSupabaseStorage(client: SupabaseClient<Database>, bucket = EVIDENCE_BUCKET): FileStorage {
  return {
    async upload(path, file, contentType) {
      const { data, error } = await client.storage.from(bucket).upload(path, file, { contentType, upsert: false });
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
