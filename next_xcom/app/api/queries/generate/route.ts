import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { isInitialized } from "@/lib/llm";
import {
  scoutGenerateFromTopic,
  scoutSuggestTopics,
} from "@/lib/scout-queries";

export async function POST(request: Request) {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  if (!isInitialized()) {
    return NextResponse.json(
      { error: "Grok not configured (set XAI_API_KEY or GROK_API_KEY)" },
      { status: 503 }
    );
  }

  let body: { mode?: string; topic?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = typeof body.mode === "string" ? body.mode.trim() : "";

  try {
    if (mode === "from_topic") {
      const topic =
        typeof body.topic === "string" ? body.topic.trim() : "";
      if (!topic) {
        return NextResponse.json(
          { error: "topic is required for mode from_topic" },
          { status: 400 }
        );
      }
      const result = await scoutGenerateFromTopic(topic);
      return NextResponse.json({ mode: "from_topic", ...result });
    }

    if (mode === "suggest_topics") {
      const suggestions = await scoutSuggestTopics();
      return NextResponse.json({ mode: "suggest_topics", suggestions });
    }

    return NextResponse.json(
      { error: 'mode must be "from_topic" or "suggest_topics"' },
      { status: 400 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("POST /api/queries/generate:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
