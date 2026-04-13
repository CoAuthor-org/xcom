import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import {
  listAllNewsletterIds,
  listNewsletterIdsMatchingFilter,
  newslettersDbAvailable,
} from "@/lib/newsletters/db";

export async function GET(request: Request) {
  const storageErr = requireSupabaseStorage();
  if (storageErr) {
    return NextResponse.json({ error: storageErr.error }, { status: 503 });
  }
  if (!newslettersDbAvailable()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";

  try {
    if (all) {
      const ids = await listAllNewsletterIds();
      return NextResponse.json({ ids, count: ids.length });
    }
    const starredOnly = url.searchParams.get("starred_only") === "1";
    const includeUnnecessary = url.searchParams.get("include_unnecessary") === "1";
    const ids = await listNewsletterIdsMatchingFilter({
      starredOnly,
      hideUnnecessary: !includeUnnecessary,
    });
    return NextResponse.json({ ids, count: ids.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
