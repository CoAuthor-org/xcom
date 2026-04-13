import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import {
  deleteNewslettersByIds,
  newslettersDbAvailable,
  patchNewslettersBulk,
} from "@/lib/newsletters/db";

const MAX_IDS = 10_000;

type BulkBody = {
  ids: string[];
  action: "star" | "unstar" | "mark_unnecessary" | "clear_unnecessary" | "delete";
};

export async function POST(request: Request) {
  const storageErr = requireSupabaseStorage();
  if (storageErr) {
    return NextResponse.json({ error: storageErr.error }, { status: 503 });
  }
  if (!newslettersDbAvailable()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: BulkBody;
  try {
    body = (await request.json()) as BulkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }
  if (body.ids.length > MAX_IDS) {
    return NextResponse.json({ error: `At most ${MAX_IDS} ids per request` }, { status: 400 });
  }
  const ids = body.ids.filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) {
    return NextResponse.json({ error: "No valid ids" }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "star":
        await patchNewslettersBulk(ids, { starred: true });
        return NextResponse.json({ ok: true, affected: ids.length });
      case "unstar":
        await patchNewslettersBulk(ids, { starred: false });
        return NextResponse.json({ ok: true, affected: ids.length });
      case "mark_unnecessary":
        await patchNewslettersBulk(ids, { unnecessary: true });
        return NextResponse.json({ ok: true, affected: ids.length });
      case "clear_unnecessary":
        await patchNewslettersBulk(ids, { unnecessary: false });
        return NextResponse.json({ ok: true, affected: ids.length });
      case "delete": {
        const deleted = await deleteNewslettersByIds(ids);
        return NextResponse.json({ ok: true, deleted });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
