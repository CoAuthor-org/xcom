export type ScouterKnowledgeSourceType = "email" | "rss" | "youtube" | "twitter";
export type ScouterDraftPlatform = "twitter" | "linkedin" | "blog";
export type ScouterDraftStatus = "pending" | "approved" | "published" | "discarded";
export type ScouterOpportunityStatus = "new" | "contacted" | "ignored";
export type ScouterRepoStatus = "pending" | "cloned" | "active";
export type ScouterQueueStatus = "queued" | "processing" | "done" | "error";

export interface ScouterKnowledge {
  id: string;
  title: string;
  content_raw: string;
  summary: string;
  source_type: ScouterKnowledgeSourceType;
  source_url: string | null;
  embedding: number[] | null;
  created_at: string;
}

export interface ScouterContentDraft {
  id: string;
  knowledge_id: string;
  platform: ScouterDraftPlatform;
  draft_text: string;
  status: ScouterDraftStatus;
  created_at: string;
}

export interface ScouterOpportunity {
  id: string;
  company_name: string;
  domain: string;
  description: string;
  source: string;
  match_score: number;
  outreach_draft: string;
  status: ScouterOpportunityStatus;
  created_at: string;
}

export interface ScouterOsRepo {
  id: string;
  repo_name: string;
  url: string;
  language: string;
  issue_title: string;
  community_link: string | null;
  status: ScouterRepoStatus;
  created_at: string;
}

export interface ScouterYoutubeQueueItem {
  id: string;
  source_url: string;
  status: ScouterQueueStatus;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface ScouterMetrics {
  pendingDrafts: number;
  highValueLeads: number;
  pendingRepos: number;
}
