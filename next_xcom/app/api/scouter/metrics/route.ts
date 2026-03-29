import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { getScouterMetrics } from "@/lib/scouter/supabase";

export async function GET() {
  const err = requireSupabaseStorage();
  if (err) return NextResponse.json({ error: err.error }, { status: 503 });
  try {
    const metrics = await getScouterMetrics();
    return NextResponse.json(metrics);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
