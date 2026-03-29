import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { createEmbedding } from "@/lib/scouter/embeddings";
import { listKnowledge, matchKnowledgeByEmbedding } from "@/lib/scouter/supabase";

export async function GET(request: Request) {
  const err = requireSupabaseStorage();
  if (err) return NextResponse.json({ error: err.error }, { status: 503 });
  const query = new URL(request.url).searchParams.get("query")?.trim() || "";
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const embedding = await createEmbedding(query).catch(() => null);
    if (embedding) {
      const matched = await matchKnowledgeByEmbedding(embedding, 0.2, 25);
      return NextResponse.json({ mode: "vector", items: matched });
    }

    const items = await listKnowledge(150);
    const norm = query.toLowerCase();
    const filtered = items.filter(
      (row) =>
        row.title.toLowerCase().includes(norm) ||
        row.summary.toLowerCase().includes(norm) ||
        row.content_raw.toLowerCase().includes(norm)
    );
    return NextResponse.json({ mode: "keyword", items: filtered.slice(0, 25) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
