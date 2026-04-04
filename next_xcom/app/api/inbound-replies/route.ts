import { NextResponse } from "next/server";
import {
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";
import { getReplyAutomationMeta } from "@/lib/reply-automation";
import { supabase } from "@/lib/supabase";

const STATUSES = [
  "pending_review",
  "approved",
  "posted",
  "rejected",
  "manual",
] as const;

export async function GET(request: Request) {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  try {
    let q = supabase
      .from("inbound_reply_queue")
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
      .order("created_at", { ascending: false });

    if (status && STATUSES.includes(status as (typeof STATUSES)[number])) {
      q = q.eq("status", status);
    }

    const { data: items, error } = await q;
    if (error) throw error;

    const meta = await getReplyAutomationMeta();

    return NextResponse.json({
      items: items ?? [],
      meta: {
        lastMentionsPollAt: meta.last_mentions_poll_at,
        lastMentionsPollError: meta.last_mentions_poll_error,
        lastMentionsSinceId: meta.last_mentions_since_id,
      },
    });
  } catch (e) {
    const errMsg = formatSupabaseError(
      e as Parameters<typeof formatSupabaseError>[0]
    );
    console.error("GET /api/inbound-replies:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
