import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { listOpportunities } from "@/lib/scouter/supabase";

export async function GET(request: Request) {
  const err = requireSupabaseStorage();
  if (err) return NextResponse.json({ error: err.error }, { status: 503 });
  const url = new URL(request.url);
  const limit = Math.min(300, Math.max(1, Number(url.searchParams.get("limit") || 120)));
  try {
    const items = await listOpportunities(limit);
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
