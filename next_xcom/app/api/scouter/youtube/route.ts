import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { enqueueYoutubeUrl, listYoutubeQueue } from "@/lib/scouter/supabase";

function isValidYoutubeUrl(input: string): boolean {
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "");
    return host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com";
  } catch {
    return false;
  }
}

export async function GET() {
  const err = requireSupabaseStorage();
  if (err) return NextResponse.json({ error: err.error }, { status: 503 });
  try {
    const items = await listYoutubeQueue(50);
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const err = requireSupabaseStorage();
  if (err) return NextResponse.json({ error: err.error }, { status: 503 });

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const url = body.url?.trim() || "";
  if (!url || !isValidYoutubeUrl(url)) {
    return NextResponse.json({ error: "Valid YouTube URL is required" }, { status: 400 });
  }
  try {
    const item = await enqueueYoutubeUrl(url);
    return NextResponse.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
