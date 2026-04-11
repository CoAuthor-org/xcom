export type NewsletterSummaryStatus = "pending" | "ok" | "error";

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
}

export interface NewsletterListItem {
  id: string;
  created_at: string;
  received_at: string | null;
  subject: string;
  from_address: string;
  tldr: string | null;
  starred: boolean;
  unnecessary: boolean;
  summary_status: NewsletterSummaryStatus;
  link_primary: string | null;
}
