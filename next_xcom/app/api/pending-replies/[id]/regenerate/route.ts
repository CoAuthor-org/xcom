import { NextResponse } from "next/server";
import {
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";
import { supabase } from "@/lib/supabase";
import { generateReplyForPost } from "@/lib/grok-reply";
import { isInitialized } from "@/lib/llm";

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
      { error: "Grok not configured" },
      { status: 503 }
    );
  }

  const { id } = await context.params;

  try {
    const { data: row, error: fetchErr } = await supabase
      .from("pending_replies")
      .select("id, original_text")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const gen = await generateReplyForPost(String(row.original_text));
    const text = gen.text;
    if (!text.trim()) {
      return NextResponse.json({ error: "Empty reply from model" }, { status: 502 });
    }

    const { data: updated, error: upErr } = await supabase
      .from("pending_replies")
      .update({ generated_reply: text })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (upErr) throw upErr;

    return NextResponse.json({ reply: updated });
  } catch (e) {
    const errMsg = formatSupabaseError(
      e as Parameters<typeof formatSupabaseError>[0]
    );
    console.error("regenerate:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
