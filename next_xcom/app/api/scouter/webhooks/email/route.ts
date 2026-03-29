import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { createEmbedding } from "@/lib/scouter/embeddings";
import {
  findKnowledgeByUrl,
  insertDrafts,
  insertKnowledge,
  matchKnowledgeByEmbedding,
} from "@/lib/scouter/supabase";
import { isScouterLlmEnabled, summarizeKnowledge, synthesizeDraftsFromKnowledge } from "@/lib/scouter/grok";

interface EmailWebhookBody {
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  MessageStream?: string;
  From?: string;
  FromFull?: { Email?: string };
  source_url?: string;
}

function verifyWebhook(request: Request): boolean {
  const secret = process.env.SCOUTER_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const header = request.headers.get("x-scouter-secret")?.trim();
  return Boolean(header && header === secret);
}

function extractPayload(body: EmailWebhookBody): {
  contentRaw: string;
  sourceUrl: string | null;
} {
  const contentRaw =
    body.TextBody?.trim() ||
    body.HtmlBody?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ||
    "";

  const sourceUrl = body.source_url?.trim() || null;
  return { contentRaw, sourceUrl };
}

export async function POST(request: Request) {
  if (!verifyWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const err = requireSupabaseStorage();
  if (err) return NextResponse.json({ error: err.error }, { status: 503 });
  if (!isScouterLlmEnabled()) {
    return NextResponse.json(
      { error: "Grok not configured (set XAI_API_KEY or GROK_API_KEY)" },
      { status: 503 }
    );
  }

  let body: EmailWebhookBody;
  try {
    body = (await request.json()) as EmailWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { contentRaw, sourceUrl } = extractPayload(body);
  if (!contentRaw) {
    return NextResponse.json(
      { error: "Missing email content: expected TextBody or HtmlBody" },
      { status: 400 }
    );
  }

  try {
    if (sourceUrl) {
      const existing = await findKnowledgeByUrl(sourceUrl);
      if (existing) {
        return NextResponse.json({ status: "duplicate", knowledgeId: existing.id });
      }
    }

    const { title, summary } = await summarizeKnowledge(contentRaw);
    const embedding = await createEmbedding(`${title}\n\n${summary}`).catch(() => null);

    if (embedding) {
      const matches = await matchKnowledgeByEmbedding(embedding, 0.92, 1).catch(() => []);
      if (matches.length > 0) {
        return NextResponse.json({
          status: "duplicate",
          knowledgeId: matches[0].id,
          similarity: matches[0].similarity,
        });
      }
    }

    const knowledge = await insertKnowledge({
      title,
      content_raw: contentRaw,
      summary,
      source_type: "email",
      source_url: sourceUrl,
      embedding,
    });
    const drafts = await synthesizeDraftsFromKnowledge(summary);
    await insertDrafts(knowledge.id, drafts);

    return NextResponse.json({
      status: "ok",
      knowledgeId: knowledge.id,
      draftCount: drafts.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
