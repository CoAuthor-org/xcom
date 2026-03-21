/**
 * GitHub OAuth and API helpers.
 * Requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env
 */

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? "";
const GITHUB_CALLBACK_URL =
  process.env.GITHUB_CALLBACK_URL ?? "http://localhost:3000/api/github/callback";

export function isGitHubConfigured(): boolean {
  return !!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);
}

export function getGitHubAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_CALLBACK_URL,
    scope: "read:user read:org",
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: GITHUB_CALLBACK_URL,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (data.error || !data.access_token) {
    throw new Error(data.error ?? "Failed to get access token");
  }
  return data.access_token;
}

export async function fetchGitHub<T>(
  path: string,
  token: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`https://api.github.com${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error: ${res.status} ${err}`);
  }
  return res.json() as Promise<T>;
}

export interface GitHubOrg {
  login: string;
  id: number;
  avatar_url?: string;
}

export async function listOrgs(token: string): Promise<GitHubOrg[]> {
  const orgs = await fetchGitHub<GitHubOrg[]>("/user/orgs", token);
  return orgs;
}

export interface GitHubPR {
  title: string;
  number: number;
  html_url: string;
  state: string;
  repository: { full_name: string; name: string };
  user: { login: string };
  created_at: string;
  body: string | null;
}

export async function listPRsForOrg(
  token: string,
  username: string,
  org: string
): Promise<GitHubPR[]> {
  const q = `is:pr author:${username} org:${org}`;
  const data = await fetchGitHub<{ items: GitHubPR[] }>("/search/issues", token, {
    q,
    sort: "created",
    order: "desc",
    per_page: "100",
  });
  return data.items ?? [];
}

export async function getCurrentUser(token: string): Promise<{ login: string }> {
  return fetchGitHub<{ login: string }>("/user", token);
}
