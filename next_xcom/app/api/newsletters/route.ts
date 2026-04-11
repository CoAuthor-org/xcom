import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { listNewsletters, newslettersDbAvailable } from "@/lib/newsletters/db";

export async function GET(request: Request) {
  const storageErr = requireSupabaseStorage();
  if (storageErr) {
    return NextResponse.json({ error: storageErr.error }, { status: 503 });
  }
  if (!newslettersDbAvailable()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "30");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const starredOnly = url.searchParams.get("starred_only") === "1";
  const includeUnnecessary = url.searchParams.get("include_unnecessary") === "1";

  try {
    const { items, total } = await listNewsletters({
      limit,
      offset,
      starredOnly,
      hideUnnecessary: !includeUnnecessary,
    });
    return NextResponse.json({ items, total, limit, offset });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
