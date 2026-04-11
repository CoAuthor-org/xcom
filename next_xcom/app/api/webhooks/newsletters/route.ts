import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import {
  findNewsletterByExternalId,
  insertNewsletterEmail,
  newslettersDbAvailable,
  updateNewsletterSummary,
  updateNewsletterSummaryError,
} from "@/lib/newsletters/db";
import type { NewsletterWebhookBody } from "@/lib/newsletters/ingest";
import { normalizeNewsletterPayload } from "@/lib/newsletters/ingest";
import { isNewsletterLlmEnabled, summarizeNewsletterEmail } from "@/lib/newsletters/summarize";
import { verifyNewslettersWebhook } from "@/lib/newsletters/webhook-auth";

export async function POST(request: Request) {
  if (!verifyNewslettersWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storageErr = requireSupabaseStorage();
  if (storageErr) {
    return NextResponse.json({ error: storageErr.error }, { status: 503 });
  }
  if (!newslettersDbAvailable()) {
    return NextResponse.json(
      { error: "Supabase not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 503 }
    );
  }

  let body: NewsletterWebhookBody;
  try {
    body = (await request.json()) as NewsletterWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const normalized = normalizeNewsletterPayload(body);
  if (!normalized.raw_text) {
    return NextResponse.json(
      { error: "Missing email content: set TextBody or HtmlBody in Zapier JSON" },
      { status: 400 }
    );
  }

  if (normalized.external_id) {
    const existing = await findNewsletterByExternalId(normalized.external_id);
    if (existing) {
      return NextResponse.json({
        status: "duplicate",
        id: existing.id,
      });
    }
  }

  let row;
  try {
    row = await insertNewsletterEmail({
      received_at: normalized.received_at,
      external_id: normalized.external_id,
      subject: normalized.subject,
      from_address: normalized.from_address,
      raw_text: normalized.raw_text,
      raw_html: normalized.raw_html,
      link_primary: normalized.link_primary,
      links: normalized.links,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const pgCode =
      e instanceof Error && "code" in e
        ? String((e as Error & { code?: string }).code ?? "")
        : "";
    if (
      pgCode === "23505" ||
      msg.includes("duplicate") ||
      msg.includes("23505") ||
      msg.includes("unique")
    ) {
      return NextResponse.json({ status: "duplicate" }, { status: 200 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!isNewsletterLlmEnabled()) {
    await updateNewsletterSummaryError(
      row.id,
      "Grok not configured (set XAI_API_KEY or GROK_API_KEY)"
    );
    return NextResponse.json({
      status: "stored",
      id: row.id,
      summarized: false,
    });
  }

  try {
    const { tldr, summary_markdown } = await summarizeNewsletterEmail({
      subject: normalized.subject,
      fromAddress: normalized.from_address,
      rawText: normalized.raw_text,
      linkPrimary: normalized.link_primary,
    });
    await updateNewsletterSummary(row.id, {
      tldr,
      summary_markdown,
      summary_status: "ok",
      summary_error: null,
    });
    return NextResponse.json({
      status: "ok",
      id: row.id,
      summarized: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateNewsletterSummaryError(row.id, msg);
    return NextResponse.json({
      status: "stored",
      id: row.id,
      summarized: false,
      summaryError: msg,
    });
  }
}
