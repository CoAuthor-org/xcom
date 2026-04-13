import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { getNewsletterDigestById, newslettersDbAvailable } from "@/lib/newsletters/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const storageErr = requireSupabaseStorage();
  if (storageErr) {
    return NextResponse.json({ error: storageErr.error }, { status: 503 });
  }
  if (!newslettersDbAvailable()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  try {
    const digest = await getNewsletterDigestById(id);
    if (!digest) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(digest);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
