export type NewsletterSummaryStatus = "pending" | "ok" | "error" | "collected";

export interface NewsletterEmailRow {
  id: string;
  created_at: string;
  received_at: string | null;
  external_id: string | null;
  subject: string;
  from_address: string;
  raw_text: string;
  raw_html: string | null;
  link_primary: string | null;
  links: unknown | null;
  tldr: string | null;
  summary_markdown: string | null;
  summary_status: NewsletterSummaryStatus;
  summary_error: string | null;
  starred: boolean;
  unnecessary: boolean;
  batch_digest_id: string | null;
}

export interface NewsletterListItem {
  id: string;
  created_at: string;
  received_at: string | null;
  subject: string;
  from_address: string;
  starred: boolean;
  unnecessary: boolean;
  link_primary: string | null;
  batch_digest_id: string | null;
}

/** List row (no full markdown) for version picker. */
export interface NewsletterDigestSummary {
  id: string;
  created_at: string;
  digest_date: string;
  part_number: number;
  email_count: number;
  tldr: string;
}

export interface NewsletterDigestRow {
  id: string;
  created_at: string;
  digest_date: string;
  part_number: number;
  period_start: string;
  period_end: string;
  tldr: string;
  summary_markdown: string;
  email_count: number;
}
