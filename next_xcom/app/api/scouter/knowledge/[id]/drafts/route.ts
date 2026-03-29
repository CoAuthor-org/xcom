import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { listDraftsByKnowledgeId } from "@/lib/scouter/supabase";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const err = requireSupabaseStorage();
  if (err) return NextResponse.json({ error: err.error }, { status: 503 });
  const { id } = await context.params;
  try {
    const drafts = await listDraftsByKnowledgeId(id);
    return NextResponse.json({ drafts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
