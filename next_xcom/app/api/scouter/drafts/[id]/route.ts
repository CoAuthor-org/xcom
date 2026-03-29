import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { updateDraft } from "@/lib/scouter/supabase";
import type { ScouterDraftStatus } from "@/lib/scouter/types";

const ALLOWED_STATUS: ScouterDraftStatus[] = [
  "pending",
  "approved",
  "published",
  "discarded",
];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const err = requireSupabaseStorage();
  if (err) return NextResponse.json({ error: err.error }, { status: 503 });
  const { id } = await context.params;
  let body: { draft_text?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: { draft_text?: string; status?: ScouterDraftStatus } = {};
  if (typeof body.draft_text === "string") patch.draft_text = body.draft_text.trim();
  if (typeof body.status === "string" && ALLOWED_STATUS.includes(body.status as ScouterDraftStatus)) {
    patch.status = body.status as ScouterDraftStatus;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  try {
    const draft = await updateDraft(id, patch);
    if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    return NextResponse.json({ draft });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
