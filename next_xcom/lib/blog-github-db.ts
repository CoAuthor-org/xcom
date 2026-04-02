import { supabase } from "@/lib/supabase";

export type BlogCommitDraftStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "published";

export interface BlogCommitDraftRow {
  id: string;
  github_user_id: number;
  repo_full_name: string;
  commit_sha: string;
  commit_message: string | null;
  diff_excerpt: string | null;
  generated_text: string;
  status: BlogCommitDraftStatus;
  created_at: string;
}

function ensureClient() {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }
  return supabase;
}

export async function upsertGitHubConnection(
  githubUserId: number,
  githubLogin: string,
  accessToken: string
): Promise<void> {
  const client = ensureClient();
  const { error } = await client.from("blog_github_connections").upsert(
    {
      github_user_id: githubUserId,
      github_login: githubLogin,
      access_token: accessToken,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "github_user_id" }
  );
  if (error) throw error;
}

export async function deleteGitHubConnection(githubUserId: number): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("blog_github_connections")
    .delete()
    .eq("github_user_id", githubUserId);
  if (error) throw error;
}

export async function getAccessTokenForUser(
  githubUserId: number
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("blog_github_connections")
    .select("access_token")
    .eq("github_user_id", githubUserId)
    .maybeSingle();
  if (error) throw error;
  const row = data as { access_token: string } | null;
  return row?.access_token ?? null;
}

/** Fallback when no per-user row exists (solo deploy). */
export function getEnvGithubFetchToken(): string {
  return (
    process.env.GITHUB_WEBHOOK_FETCH_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GITHUB_ACCESS_TOKEN?.trim() ||
    process.env.SCOUTER_GITHUB_TOKEN?.trim() ||
    ""
  );
}

export interface TrackedRepoRow {
  id: string;
  github_user_id: number;
  full_name: string;
  branch_filter: string | null;
}

export async function listTrackedReposForUser(
  githubUserId: number
): Promise<TrackedRepoRow[]> {
  const client = ensureClient();
  const { data, error } = await client
    .from("blog_github_tracked_repos")
    .select("id, github_user_id, full_name, branch_filter")
    .eq("github_user_id", githubUserId)
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as TrackedRepoRow[];
}

export async function setTrackedReposForUser(
  githubUserId: number,
  fullNames: string[]
): Promise<void> {
  const client = ensureClient();
  const normalized = [...new Set(fullNames.map((n) => n.trim()).filter(Boolean))];
  const { error: delErr } = await client
    .from("blog_github_tracked_repos")
    .delete()
    .eq("github_user_id", githubUserId);
  if (delErr) throw delErr;
  if (normalized.length === 0) return;
  const rows = normalized.map((full_name) => ({
    github_user_id: githubUserId,
    full_name,
    branch_filter: null as string | null,
  }));
  const { error: insErr } = await client.from("blog_github_tracked_repos").insert(rows);
  if (insErr) throw insErr;
}

/** All tracker rows for a repo with a usable token (DB OAuth token or env fallback). */
export async function findTrackersForRepo(
  fullName: string
): Promise<{ github_user_id: number; branch_filter: string | null; access_token: string }[]> {
  if (!supabase) return [];
  const { data: tracked, error: tErr } = await supabase
    .from("blog_github_tracked_repos")
    .select("github_user_id, branch_filter")
    .eq("full_name", fullName);
  if (tErr) throw tErr;
  const rows = (tracked ?? []) as { github_user_id: number; branch_filter: string | null }[];
  const envTok = getEnvGithubFetchToken();
  const out: { github_user_id: number; branch_filter: string | null; access_token: string }[] =
    [];
  for (const r of rows) {
    const dbTok = await getAccessTokenForUser(r.github_user_id);
    const access_token = dbTok || envTok;
    if (access_token) {
      out.push({
        github_user_id: r.github_user_id,
        branch_filter: r.branch_filter,
        access_token,
      });
    }
  }
  return out;
}

export async function insertBlogCommitDraft(row: {
  github_user_id: number;
  repo_full_name: string;
  commit_sha: string;
  commit_message: string | null;
  diff_excerpt: string | null;
  generated_text: string;
  status?: BlogCommitDraftStatus;
}): Promise<{ inserted: boolean; id?: string }> {
  const client = ensureClient();
  const { data, error } = await client
    .from("blog_commit_drafts")
    .insert({
      github_user_id: row.github_user_id,
      repo_full_name: row.repo_full_name,
      commit_sha: row.commit_sha,
      commit_message: row.commit_message,
      diff_excerpt: row.diff_excerpt,
      generated_text: row.generated_text,
      status: row.status ?? "pending",
    })
    .select("id")
    .limit(1);
  if (error) {
    if (error.code === "23505") {
      return { inserted: false };
    }
    throw error;
  }
  const first = Array.isArray(data) ? data[0] : data;
  const id = first && typeof first === "object" && "id" in first ? String(first.id) : undefined;
  return { inserted: true, id };
}

export async function listBlogCommitDrafts(
  githubUserId: number,
  limit = 50
): Promise<BlogCommitDraftRow[]> {
  const client = ensureClient();
  const { data, error } = await client
    .from("blog_commit_drafts")
    .select("*")
    .eq("github_user_id", githubUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BlogCommitDraftRow[];
}

export async function updateBlogCommitDraft(
  id: string,
  githubUserId: number,
  patch: Partial<Pick<BlogCommitDraftRow, "generated_text" | "status">>
): Promise<BlogCommitDraftRow | null> {
  const client = ensureClient();
  const { data, error } = await client
    .from("blog_commit_drafts")
    .update(patch)
    .eq("id", id)
    .eq("github_user_id", githubUserId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as BlogCommitDraftRow | null;
}

export function isBlogGithubDbConfigured(): boolean {
  return !!supabase;
}
