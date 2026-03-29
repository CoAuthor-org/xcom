import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { updateOpportunity } from "@/lib/scouter/supabase";
import type { ScouterOpportunityStatus } from "@/lib/scouter/types";

const ALLOWED: ScouterOpportunityStatus[] = ["new", "contacted", "ignored"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const err = requireSupabaseStorage();
  if (err) return NextResponse.json({ error: err.error }, { status: 503 });
  const { id } = await context.params;
  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.status || !ALLOWED.includes(body.status as ScouterOpportunityStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const item = await updateOpportunity(id, body.status as ScouterOpportunityStatus);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
