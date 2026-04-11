import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import {
  deleteOldUnstarredByEffectiveDate,
  newslettersDbAvailable,
} from "@/lib/newsletters/db";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const url = new URL(request.url);
  const q = url.searchParams.get("secret");
  return bearer === secret || q === secret;
}

async function handleCleanup(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const storageErr = requireSupabaseStorage();
  if (storageErr) {
    return NextResponse.json({ error: storageErr.error }, { status: 503 });
  }
  if (!newslettersDbAvailable()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const deleted = await deleteOldUnstarredByEffectiveDate(cutoff);
    return NextResponse.json({
      ok: true,
      deleted,
      cutoff,
      rule: "Removed unstarred rows with coalesce(received_at, created_at) < cutoff",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[newsletters-cleanup]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleCleanup(request);
}

export async function POST(request: Request) {
  return handleCleanup(request);
}
