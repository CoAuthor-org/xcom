import { supabase } from "@/lib/supabase";
import type {
  ScouterContentDraft,
  ScouterKnowledge,
  ScouterMetrics,
  ScouterOpportunity,
  ScouterOsRepo,
  ScouterQueueStatus,
  ScouterYoutubeQueueItem,
} from "@/lib/scouter/types";

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }
  return supabase;
}

export async function getScouterMetrics(): Promise<ScouterMetrics> {
  const client = ensureSupabase();
  const [drafts, leads, repos] = await Promise.all([
    client
      .from("scouter_content_drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    client
      .from("scouter_opportunities")
      .select("id", { count: "exact", head: true })
      .gt("match_score", 8)
      .eq("status", "new"),
    client
      .from("scouter_os_repos")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  if (drafts.error) throw drafts.error;
  if (leads.error) throw leads.error;
  if (repos.error) throw repos.error;

  return {
    pendingDrafts: drafts.count ?? 0,
    highValueLeads: leads.count ?? 0,
    pendingRepos: repos.count ?? 0,
  };
}

export async function listKnowledge(limit = 80): Promise<ScouterKnowledge[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("scouter_knowledge")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ScouterKnowledge[];
}

export async function listDraftsByKnowledgeId(
  knowledgeId: string
): Promise<ScouterContentDraft[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("scouter_content_drafts")
    .select("*")
    .eq("knowledge_id", knowledgeId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScouterContentDraft[];
}

export async function updateDraft(
  id: string,
  patch: Partial<Pick<ScouterContentDraft, "draft_text" | "status">>
): Promise<ScouterContentDraft | null> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("scouter_content_drafts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as ScouterContentDraft | null) ?? null;
}

export async function insertKnowledge(input: {
  title: string;
  content_raw: string;
  summary: string;
  source_type: ScouterKnowledge["source_type"];
  source_url?: string | null;
  embedding?: number[] | null;
}): Promise<ScouterKnowledge> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("scouter_knowledge")
    .insert({
      title: input.title,
      content_raw: input.content_raw,
      summary: input.summary,
      source_type: input.source_type,
      source_url: input.source_url ?? null,
      embedding: input.embedding ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ScouterKnowledge;
}

export async function insertDrafts(
  knowledgeId: string,
  drafts: Array<{ platform: "twitter" | "linkedin" | "blog"; draft_text: string }>
) {
  if (drafts.length === 0) return;
  const client = ensureSupabase();
  const { error } = await client.from("scouter_content_drafts").insert(
    drafts.map((d) => ({
      knowledge_id: knowledgeId,
      platform: d.platform,
      draft_text: d.draft_text,
      status: "pending",
    }))
  );
  if (error) throw error;
}

export async function findKnowledgeByUrl(sourceUrl: string): Promise<ScouterKnowledge | null> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("scouter_knowledge")
    .select("*")
    .eq("source_url", sourceUrl)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ScouterKnowledge | null) ?? null;
}

export async function matchKnowledgeByEmbedding(
  embedding: number[],
  threshold = 0.22,
  limit = 1
): Promise<Array<{ id: string; title: string; summary: string; source_url: string | null; similarity: number }>> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc("scouter_match_knowledge", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
  });
  if (error) throw error;
  return (data ??
    []) as Array<{ id: string; title: string; summary: string; source_url: string | null; similarity: number }>;
}

export async function upsertOpportunity(input: {
  company_name: string;
  domain: string;
  description: string;
  source: string;
  match_score: number;
  outreach_draft: string;
}) {
  const client = ensureSupabase();
  const { data: existing } = await client
    .from("scouter_opportunities")
    .select("id")
    .eq("domain", input.domain)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await client
      .from("scouter_opportunities")
      .update({
        company_name: input.company_name,
        description: input.description,
        source: input.source,
        match_score: input.match_score,
        outreach_draft: input.outreach_draft,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await client
    .from("scouter_opportunities")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

export async function listOpportunities(limit = 120): Promise<ScouterOpportunity[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("scouter_opportunities")
    .select("*")
    .order("match_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ScouterOpportunity[];
}

export async function updateOpportunity(
  id: string,
  status: ScouterOpportunity["status"]
): Promise<ScouterOpportunity | null> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("scouter_opportunities")
    .update({ status })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as ScouterOpportunity | null) ?? null;
}

export async function listRepos(limit = 120): Promise<ScouterOsRepo[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("scouter_os_repos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ScouterOsRepo[];
}

export async function upsertRepo(input: {
  repo_name: string;
  url: string;
  language: string;
  issue_title: string;
  community_link?: string | null;
}) {
  const client = ensureSupabase();
  const { data: existing } = await client
    .from("scouter_os_repos")
    .select("id")
    .eq("url", input.url)
    .eq("issue_title", input.issue_title)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await client
      .from("scouter_os_repos")
      .update({
        repo_name: input.repo_name,
        language: input.language,
        community_link: input.community_link ?? null,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await client
    .from("scouter_os_repos")
    .insert({
      ...input,
      community_link: input.community_link ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

export async function updateRepoStatus(
  id: string,
  status: ScouterOsRepo["status"]
): Promise<ScouterOsRepo | null> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("scouter_os_repos")
    .update({ status })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as ScouterOsRepo | null) ?? null;
}

export async function enqueueYoutubeUrl(sourceUrl: string): Promise<ScouterYoutubeQueueItem> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("scouter_youtube_queue")
    .insert({ source_url: sourceUrl, status: "queued" })
    .select("*")
    .single();
  if (error) throw error;
  return data as ScouterYoutubeQueueItem;
}

export async function listYoutubeQueue(limit = 40): Promise<ScouterYoutubeQueueItem[]> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from("scouter_youtube_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ScouterYoutubeQueueItem[];
}

export async function setYoutubeQueueStatus(
  id: string,
  status: ScouterQueueStatus,
  errorMessage?: string | null
) {
  const client = ensureSupabase();
  const patch: {
    status: ScouterQueueStatus;
    error_message?: string | null;
    processed_at?: string | null;
  } = { status };
  if (typeof errorMessage !== "undefined") patch.error_message = errorMessage;
  if (status === "done" || status === "error") patch.processed_at = new Date().toISOString();
  const { error } = await client.from("scouter_youtube_queue").update(patch).eq("id", id);
  if (error) throw error;
}
