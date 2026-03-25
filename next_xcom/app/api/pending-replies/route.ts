import { NextResponse } from "next/server";
import {
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";
import { supabase } from "@/lib/supabase";
import {
  countTodayNonRejected,
  getDailyCap,
  getIstDayBoundsUtc,
  getReplyAutomationMeta,
} from "@/lib/reply-automation";

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
  const today = url.searchParams.get("today") === "1";

  try {
    let q = supabase
      .from("pending_replies")
      .select(
        "id, tweet_id, original_text, author_username, post_url, generated_reply, status, created_at, processed_at"
      )
      .order("created_at", { ascending: false });

    if (status && ["pending", "ready", "done", "rejected"].includes(status)) {
      q = q.eq("status", status);
    }

    if (today) {
      const { start, end } = getIstDayBoundsUtc();
      q = q
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());
    }

    const { data: replies, error } = await q;
    if (error) throw error;

    const [todayCount, meta] = await Promise.all([
      countTodayNonRejected(),
      getReplyAutomationMeta(),
    ]);

    return NextResponse.json({
      replies: replies ?? [],
      meta: {
        todayCount,
        dailyCap: getDailyCap(),
        lastDiscoverAt: meta.last_discover_at,
        lastDiscoverError: meta.last_discover_error,
      },
    });
  } catch (e) {
    const errMsg = formatSupabaseError(
      e as Parameters<typeof formatSupabaseError>[0]
    );
    console.error("GET /api/pending-replies:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
