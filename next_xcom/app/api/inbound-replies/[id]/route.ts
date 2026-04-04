import { NextResponse } from "next/server";
import {
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";
import { supabase } from "@/lib/supabase";

const STATUSES = [
  "pending_review",
  "approved",
  "posted",
  "rejected",
  "manual",
] as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  let body: { edited_reply?: string; status?: string };
  try {
    body = (await request.json()) as { edited_reply?: string; status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.edited_reply === "string") {
    patch.edited_reply = body.edited_reply;
  }
  if (body.status != null) {
    if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
    if (body.status === "rejected" || body.status === "manual") {
      patch.reviewed_at = new Date().toISOString();
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Provide edited_reply and/or status" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("inbound_reply_queue")
      .update(patch)
      .eq("id", id)
      .select(
        `
        id,
        mention_id,
        original_context,
        grok_suggestion,
        edited_reply,
        status,
        posted_tweet_id,
        reviewed_at,
        created_at,
        incoming_mentions (
          id,
          author_id,
          author_username,
          text,
          conversation_id,
          in_reply_to_tweet_id,
          created_at
        )
      `
      )
      .single();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ item: data });
  } catch (e) {
    const errMsg = formatSupabaseError(
      e as Parameters<typeof formatSupabaseError>[0]
    );
    console.error("PATCH /api/inbound-replies/[id]:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
