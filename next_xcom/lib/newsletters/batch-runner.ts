import {
  attachEmailsToDigest,
  insertNewsletterDigest,
  listEmailsPendingDigestInWindow,
  newslettersDbAvailable,
} from "@/lib/newsletters/db";
import { isNewsletterLlmEnabled, summarizeNewsletterBatch } from "@/lib/newsletters/batch-llm";
const WINDOW_MS = 24 * 60 * 60 * 1000;

export type BatchSummarizeResult =
  | {
      ok: true;
      skipped: true;
      message: string;
    }
  | {
      ok: true;
      skipped?: false;
      digestId: string;
      emailCount: number;
      periodStart: string;
      periodEnd: string;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Collects newsletter emails in the last 24 hours that are not yet in any digest,
 * runs one LLM call, stores `newsletter_digests`, and links rows via `batch_digest_id`.
 */
export async function runNewsletterBatchSummarize(): Promise<BatchSummarizeResult> {
  if (!newslettersDbAvailable()) {
    return { ok: false, error: "Supabase not configured" };
  }

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - WINDOW_MS);

  const emails = await listEmailsPendingDigestInWindow(
    periodStart.toISOString(),
    periodEnd.toISOString()
  );

  if (emails.length === 0) {
    return {
      ok: true,
      skipped: true,
      message: "No unsummarized emails in the last 24 hours.",
    };
  }

  if (!isNewsletterLlmEnabled()) {
    return {
      ok: false,
      error: "Grok not configured (set XAI_API_KEY or GROK_API_KEY)",
    };
  }

  try {
    const inputs = emails.map((e) => ({
      id: e.id,
      subject: e.subject,
      from_address: e.from_address,
      raw_text: e.raw_text,
      link_primary: e.link_primary,
    }));

    const { tldr, summary_markdown } = await summarizeNewsletterBatch(
      inputs,
      periodStart.toISOString(),
      periodEnd.toISOString()
    );

    const digest = await insertNewsletterDigest({
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      tldr,
      summary_markdown,
      email_count: emails.length,
    });

    await attachEmailsToDigest(
      emails.map((e) => e.id),
      digest.id
    );

    return {
      ok: true,
      digestId: digest.id,
      emailCount: emails.length,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
