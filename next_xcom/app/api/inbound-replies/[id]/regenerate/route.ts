import { NextResponse } from "next/server";
import {
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";
import { generateReplyForInboundContext } from "@/lib/grok-reply";
import { isInitialized } from "@/lib/llm";
import { supabase } from "@/lib/supabase";

type OriginalContext = {
  mention?: {
    author_username?: string;
    text?: string;
  };
  parent_tweet?: { text?: string } | null;
  thread_summary?: string | null;
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!isInitialized()) {
    return NextResponse.json(
      { error: "Grok not configured (set XAI_API_KEY or GROK_API_KEY)" },
      { status: 503 }
    );
  }

  const { id } = await context.params;

  try {
    const { data: row, error: fetchErr } = await supabase
      .from("inbound_reply_queue")
      .select("id, original_context, status")
      .eq("id", id)
      .single();
    if (fetchErr) throw fetchErr;
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if ((row.status as string) === "posted") {
      return NextResponse.json(
        { error: "Cannot regenerate after posted" },
        { status: 400 }
      );
    }

    const ctx = (row.original_context ?? {}) as OriginalContext;
    const mention = ctx.mention ?? {};
    const gen = await generateReplyForInboundContext({
      mentionAuthor: mention.author_username ?? "user",
      mentionText: mention.text ?? "",
      parentTweetText: ctx.parent_tweet?.text,
      threadSummary: ctx.thread_summary ?? undefined,
    });

    const { data: updated, error: updErr } = await supabase
      .from("inbound_reply_queue")
      .update({ grok_suggestion: gen.text })
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

    return NextResponse.json({ item: updated });
  } catch (e) {
    const errMsg = formatSupabaseError(
      e as Parameters<typeof formatSupabaseError>[0]
    );
    console.error("POST /api/inbound-replies/[id]/regenerate:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
