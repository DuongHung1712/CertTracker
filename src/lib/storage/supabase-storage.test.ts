import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createSupabaseStorage } from "@/lib/storage/supabase-storage";
import type { Database } from "@/types/database";

type UploadCall = { bucket: string; path: string; body: unknown; options: unknown };

function fakeClient(calls: UploadCall[]) {
  const client = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, body: unknown, options: unknown) => {
          calls.push({ bucket, path, body, options });
          return { data: { path }, error: null };
        },
      }),
    },
  };
  return client as unknown as SupabaseClient<Database>;
}

describe("createSupabaseStorage.upload", () => {
  it("hands storage-js the decided content type, not the File's own (browser-supplied) type", async () => {
    const calls: UploadCall[] = [];
    const untyped = new File([new TextEncoder().encode("%PDF-1.4")], "x.pdf", { type: "" });
    await createSupabaseStorage(fakeClient(calls)).upload("m/r/1.pdf", untyped, "application/pdf");

    const [call] = calls;
    expect(call?.bucket).toBe("certificates");
    expect(call?.options).toEqual({ contentType: "application/pdf", upsert: false });
    // storage-js only honours options.contentType for non-Blob bodies, so the body must not be a Blob.
    expect(call?.body).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(call?.body as ArrayBuffer)).toBe("%PDF-1.4");
  });
});
