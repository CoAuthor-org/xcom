import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import {
  deleteOldUnstarredByEffectiveDate,
  deleteUnnecessaryNewsletters,
  newslettersDbAvailable,
} from "@/lib/newsletters/db";

type ActionBody = { type: "clear_unnecessary" } | { type: "purge_old" };

export async function POST(request: Request) {
  const storageErr = requireSupabaseStorage();
  if (storageErr) {
    return NextResponse.json({ error: storageErr.error }, { status: 503 });
  }
  if (!newslettersDbAvailable()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.type === "clear_unnecessary") {
      const deleted = await deleteUnnecessaryNewsletters();
      return NextResponse.json({ ok: true, deleted });
    }
    if (body.type === "purge_old") {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const deleted = await deleteOldUnstarredByEffectiveDate(cutoff);
      return NextResponse.json({ ok: true, deleted, cutoff });
    }
    return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
