/**
 * Expected JSON keys from Zapier "Webhooks by Zapier" POST (map Gmail fields into this shape):
 * - Subject (string)
 * - TextBody (string, preferred plain body)
 * - HtmlBody (string, optional; used if TextBody empty — tags stripped)
 * - From (string) or FromFull.Email
 * - MessageId | external_id (string, optional, for deduplication)
 * - Link | ThreadUrl (string, optional primary URL)
 * - links (array of strings or {url,label}, optional — stored as jsonb)
 * - ReceivedAt (ISO string, optional)
 */

export interface NewsletterWebhookBody {
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  From?: string;
  FromFull?: { Email?: string };
  MessageId?: string;
  external_id?: string;
  Link?: string;
  ThreadUrl?: string;
  links?: unknown;
  ReceivedAt?: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeNewsletterPayload(body: NewsletterWebhookBody): {
  subject: string;
  from_address: string;
  raw_text: string;
  raw_html: string | null;
  external_id: string | null;
  link_primary: string | null;
  links: unknown | null;
  received_at: string | null;
} {
  const raw_html = body.HtmlBody?.trim() ? body.HtmlBody.trim() : null;
  const raw_text =
    body.TextBody?.trim() ||
    (raw_html ? stripHtml(raw_html) : "") ||
    "";

  const from_address =
    body.From?.trim() ||
    body.FromFull?.Email?.trim() ||
    "";

  const external_id =
    body.external_id?.trim() ||
    body.MessageId?.trim() ||
    null;

  const link_primary =
    body.Link?.trim() ||
    body.ThreadUrl?.trim() ||
    null;

  let links: unknown | null = null;
  if (body.links != null) {
    links = body.links;
  }

  let received_at: string | null = null;
  if (body.ReceivedAt?.trim()) {
    const t = Date.parse(body.ReceivedAt.trim());
    if (!Number.isNaN(t)) {
      received_at = new Date(t).toISOString();
    }
  }

  return {
    subject: body.Subject?.trim() || "(no subject)",
    from_address,
    raw_text,
    raw_html,
    external_id,
    link_primary,
    links,
    received_at,
  };
}
