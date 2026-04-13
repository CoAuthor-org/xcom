import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import {
  countPendingDigestEmailsInWindow,
  listNewsletterDigestSummaries,
  newslettersDbAvailable,
} from "@/lib/newsletters/db";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  const storageErr = requireSupabaseStorage();
  if (storageErr) {
    return NextResponse.json({ error: storageErr.error }, { status: 503 });
  }
  if (!newslettersDbAvailable()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - WINDOW_MS);
    const [digests, pendingInWindow] = await Promise.all([
      listNewsletterDigestSummaries(80),
      countPendingDigestEmailsInWindow(periodStart.toISOString(), periodEnd.toISOString()),
    ]);
    return NextResponse.json({
      digests,
      pendingInWindow,
      windowHours: 24,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
