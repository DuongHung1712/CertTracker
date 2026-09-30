import { NextResponse } from "next/server";
import { idSchema } from "@/features/records/schema";
import { createSupabaseStorage } from "@/lib/storage/supabase-storage";
import { createClient } from "@/lib/supabase/server";

const notFound = () => new NextResponse("Không tìm thấy minh chứng.", { status: 404 });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = idSchema.safeParse(await params);
  if (!parsed.success) return notFound();
  const supabase = await createClient();
  // RLS: a record the user cannot see reads as "not found" — no distinction is leaked.
  const { data } = await supabase
    .from("training_records")
    .select("evidence_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!data?.evidence_path) return notFound();
  try {
    const url = await createSupabaseStorage(supabase).getSignedUrl(data.evidence_path, 60);
    return NextResponse.redirect(url, { status: 307, headers: { "Cache-Control": "no-store" } });
  } catch {
    return notFound();
  }
}
