import { createHmac, timingSafeEqual } from "crypto";
import { fetchCommitDiff } from "@/lib/github";
import { generateText, isInitialized } from "@/lib/llm";
import { findTrackersForRepo, insertBlogCommitDraft } from "@/lib/blog-github-db";

const MAX_DIFF_CHARS = 14_000;

const BUILD_IN_PUBLIC_SYSTEM = `You are an indie developer building in public. Given a commit message and a code diff excerpt, write ONE short X (Twitter) post under 280 characters. Be concrete and enthusiastic, not corporate. You may use #buildinpublic if it fits naturally. Output only the post text, no quotes or labels.`;

export function verifyGithubWebhookSignature(
  secret: string,
  rawBody: string,
  signature256: string | null
): boolean {
  if (!signature256?.startsWith("sha256=")) return false;
  const sig = signature256.slice(7);
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function branchMatches(ref: string, branchFilter: string | null): boolean {
  const branch = ref.replace(/^refs\/heads\//, "");
  const f = branchFilter?.trim();
  if (f) return branch === f;
  return branch === "main" || branch === "master";
}

interface GitHubPushPayload {
  ref?: string;
  commits?: {
    id: string;
    message: string;
    url?: string;
    /** false when this commit was already pushed (e.g. included in an earlier push). */
    distinct?: boolean;
  }[];
  repository?: { full_name: string; default_branch?: string };
}

function parseOwnerRepo(fullName: string): { owner: string; repo: string } | null {
  const i = fullName.indexOf("/");
  if (i <= 0 || i >= fullName.length - 1) return null;
  return { owner: fullName.slice(0, i), repo: fullName.slice(i + 1) };
}

async function draftTweetFromCommit(
  commitMessage: string,
  diffExcerpt: string
): Promise<string> {
  if (!isInitialized()) {
    return commitMessage.split("\n")[0].slice(0, 280);
  }
  const userContent = `Commit message:\n${commitMessage}\n\nDiff excerpt:\n${diffExcerpt}`;
  const { text } = await generateText(userContent, {
    systemPrompt: BUILD_IN_PUBLIC_SYSTEM,
    maxTokens: 400,
    temperature: 0.65,
  });
  return text.slice(0, 280);
}

export interface ProcessPushResult {
  ok: boolean;
  reason?: string;
  processed?: number;
  errors?: string[];
}

export async function processGitHubPushPayload(
  rawBody: string,
  payload: GitHubPushPayload
): Promise<ProcessPushResult> {
  const fullName = payload.repository?.full_name;
  const ref = payload.ref;
  const commits = payload.commits ?? [];
  if (!fullName || !ref) {
    return { ok: true, reason: "missing_repo_or_ref", processed: 0 };
  }

  const trackers = await findTrackersForRepo(fullName);
  if (trackers.length === 0) {
    return { ok: true, reason: "not_tracked", processed: 0 };
  }

  const matching = trackers.filter((t) => branchMatches(ref, t.branch_filter));
  if (matching.length === 0) {
    return { ok: true, reason: "branch_filtered", processed: 0 };
  }

  const parts = parseOwnerRepo(fullName);
  if (!parts) {
    return { ok: false, reason: "bad_full_name", processed: 0 };
  }

  let processed = 0;
  const errors: string[] = [];

  for (const commit of commits) {
    if (commit.distinct === false) continue;
    const sha = commit.id;
    if (!sha) continue;
    const message = commit.message ?? "";

    for (const tracker of matching) {
      try {
        let diffRaw = "";
        try {
          diffRaw = await fetchCommitDiff(
            tracker.access_token,
            parts.owner,
            parts.repo,
            sha
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`${sha}: diff ${msg}`);
          diffRaw = "";
        }
        const diffExcerpt = diffRaw.slice(0, MAX_DIFF_CHARS);
        const generated = await draftTweetFromCommit(message, diffExcerpt || "(no diff)");
        const ins = await insertBlogCommitDraft({
          github_user_id: tracker.github_user_id,
          repo_full_name: fullName,
          commit_sha: sha,
          commit_message: message || null,
          diff_excerpt: diffExcerpt || null,
          generated_text: generated,
        });
        if (ins.inserted) processed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${sha}: ${msg}`);
      }
    }
  }

  return { ok: true, processed, errors: errors.length ? errors : undefined };
}
