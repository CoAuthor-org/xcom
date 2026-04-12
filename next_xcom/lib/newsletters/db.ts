import { supabase } from "@/lib/supabase";
import type { NewsletterDigestRow, NewsletterEmailRow, NewsletterListItem } from "./types";

const TABLE = "newsletter_emails";
const DIGESTS = "newsletter_digests";

export function newslettersDbAvailable(): boolean {
  return Boolean(supabase);
}

export async function findNewsletterByExternalId(
  externalId: string
): Promise<NewsletterEmailRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("external_id", externalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as NewsletterEmailRow) ?? null;
}

export async function insertNewsletterEmail(row: {
  received_at: string | null;
  external_id: string | null;
  subject: string;
  from_address: string;
  raw_text: string;
  raw_html: string | null;
  link_primary: string | null;
  links: unknown | null;
}): Promise<NewsletterEmailRow> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      received_at: row.received_at,
      external_id: row.external_id,
      subject: row.subject,
      from_address: row.from_address,
      raw_text: row.raw_text,
      raw_html: row.raw_html,
      link_primary: row.link_primary,
      links: row.links,
      summary_status: "collected",
    })
    .select("*")
    .single();
  if (error) {
    const err = new Error(error.message) as Error & { code?: string };
    err.code = error.code;
    throw err;
  }
  return data as NewsletterEmailRow;
}

export async function updateNewsletterSummary(
  id: string,
  patch: {
    tldr: string;
    summary_markdown: string;
    summary_status: "ok";
    summary_error: null;
  }
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from(TABLE)
    .update({
      tldr: patch.tldr,
      summary_markdown: patch.summary_markdown,
      summary_status: patch.summary_status,
      summary_error: patch.summary_error,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateNewsletterSummaryError(
  id: string,
  message: string
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from(TABLE)
    .update({
      summary_status: "error",
      summary_error: message.slice(0, 2000),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getNewsletterById(id: string): Promise<NewsletterEmailRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as NewsletterEmailRow) ?? null;
}

export async function patchNewsletter(
  id: string,
  patch: { starred?: boolean; unnecessary?: boolean }
): Promise<NewsletterEmailRow | null> {
  if (!supabase) return null;
  const updates: Record<string, unknown> = {};
  if (typeof patch.starred === "boolean") updates.starred = patch.starred;
  if (typeof patch.unnecessary === "boolean") updates.unnecessary = patch.unnecessary;
  if (Object.keys(updates).length === 0) return getNewsletterById(id);
  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as NewsletterEmailRow) ?? null;
}

export async function listNewsletters(params: {
  limit: number;
  offset: number;
  starredOnly: boolean;
  hideUnnecessary: boolean;
}): Promise<{ items: NewsletterListItem[]; total: number }> {
  if (!supabase) return { items: [], total: 0 };
  const limit = Math.min(Math.max(params.limit, 1), 100);
  const offset = Math.max(params.offset, 0);

  let countQ = supabase.from(TABLE).select("*", { count: "exact", head: true });
  if (params.hideUnnecessary) countQ = countQ.eq("unnecessary", false);
  if (params.starredOnly) countQ = countQ.eq("starred", true);
  const { count, error: countErr } = await countQ;
  if (countErr) throw new Error(countErr.message);

  let q = supabase
    .from(TABLE)
    .select(
      "id, created_at, received_at, subject, from_address, starred, unnecessary, link_primary, batch_digest_id"
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.hideUnnecessary) {
    q = q.eq("unnecessary", false);
  }
  if (params.starredOnly) {
    q = q.eq("starred", true);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as NewsletterListItem[];
  return { items: rows, total: count ?? 0 };
}

export async function deleteUnnecessaryNewsletters(): Promise<number> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq("unnecessary", true)
    .eq("starred", false)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/** Requires `delete_old_newsletter_emails` RPC from newsletter_emails.sql. */
export async function deleteOldUnstarredByEffectiveDate(cutoffIso: string): Promise<number> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("delete_old_newsletter_emails", {
    cutoff: cutoffIso,
  });
  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : Number(data ?? 0);
}

export async function listEmailsPendingDigestInWindow(
  periodStartIso: string,
  periodEndIso: string
): Promise<NewsletterEmailRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .is("batch_digest_id", null)
    .gte("created_at", periodStartIso)
    .lte("created_at", periodEndIso)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as NewsletterEmailRow[];
}

export async function countPendingDigestEmailsInWindow(
  periodStartIso: string,
  periodEndIso: string
): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .is("batch_digest_id", null)
    .gte("created_at", periodStartIso)
    .lte("created_at", periodEndIso);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function insertNewsletterDigest(row: {
  period_start: string;
  period_end: string;
  tldr: string;
  summary_markdown: string;
  email_count: number;
}): Promise<NewsletterDigestRow> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from(DIGESTS)
    .insert({
      period_start: row.period_start,
      period_end: row.period_end,
      tldr: row.tldr,
      summary_markdown: row.summary_markdown,
      email_count: row.email_count,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as NewsletterDigestRow;
}

export async function attachEmailsToDigest(emailIds: string[], digestId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  if (emailIds.length === 0) return;
  const { error } = await supabase
    .from(TABLE)
    .update({ batch_digest_id: digestId })
    .in("id", emailIds);
  if (error) throw new Error(error.message);
}

export async function getLatestNewsletterDigest(): Promise<NewsletterDigestRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(DIGESTS)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as NewsletterDigestRow) ?? null;
}

export async function getNewsletterDigestById(id: string): Promise<NewsletterDigestRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from(DIGESTS).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as NewsletterDigestRow) ?? null;
}
