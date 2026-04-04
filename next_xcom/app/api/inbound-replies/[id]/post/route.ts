import { NextResponse } from "next/server";
import {
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";
import { supabase } from "@/lib/supabase";
import { postReplyToTweet } from "@/lib/x-twitter-user";

export async function POST(
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
  let body: { text?: string } = {};
  try {
    const raw = await request.text();
    if (raw.trim()) body = JSON.parse(raw) as { text?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const { data: row, error: fetchErr } = await supabase
      .from("inbound_reply_queue")
      .select("id, mention_id, grok_suggestion, edited_reply, status")
      .eq("id", id)
      .single();
    if (fetchErr) throw fetchErr;
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const status = row.status as string;
    if (status === "posted") {
      return NextResponse.json(
        { error: "Already posted" },
        { status: 400 }
      );
    }
    if (status === "rejected") {
      return NextResponse.json(
        { error: "Cannot post a rejected item" },
        { status: 400 }
      );
    }

    const text =
      typeof body.text === "string" && body.text.trim()
        ? body.text.trim()
        : String(
            (row.edited_reply as string | null)?.trim() ||
              (row.grok_suggestion as string) ||
              ""
          );

    const mentionId = row.mention_id as string;
    const postedTweetId = await postReplyToTweet(mentionId, text);

    const reviewedAt = new Date().toISOString();
    const { data: updated, error: updErr } = await supabase
      .from("inbound_reply_queue")
      .update({
        status: "posted",
        posted_tweet_id: postedTweetId,
        reviewed_at: reviewedAt,
        edited_reply:
          typeof body.text === "string" && body.text.trim()
            ? body.text.trim()
            : (row.edited_reply as string | null),
      })
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
    if (updErr) throw updErr;

    return NextResponse.json({ item: updated, posted_tweet_id: postedTweetId });
  } catch (e) {
    const errMsg = formatSupabaseError(
      e as Parameters<typeof formatSupabaseError>[0]
    );
    console.error("POST /api/inbound-replies/[id]/post:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
