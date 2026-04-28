"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createCompany, listCompanies, upsertRepositoriesForCompany } from "@/lib/crm/db";
import type { CompanyInsert, CompanyRow, RepositoryUpsertInput } from "@/lib/crm/types";
import { getCurrentUser } from "@/lib/github";
import { upsertGitHubConnection } from "@/lib/blog-github-db";

interface GitHubRepoApiItem {
  name: string;
  html_url: string;
  language: string | null;
  private: boolean;
}

export interface CompanyRepoInput {
  name: string;
  url: string;
  primary_language: string | null;
  is_open_source: boolean;
}

function parseGithubOrgName(githubOrgName: string): string {
  const value = githubOrgName.trim();
  if (!value) {
    throw new Error("GitHub organization is required");
  }

  if (value.includes("github.com")) {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error("Invalid GitHub organization URL");
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      throw new Error("GitHub organization URL must include an org");
    }
    return segments[0];
  }

  return value.replace(/^@/, "").split("/")[0];
}

async function getGitHubAuthToken(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get("github_token")?.value?.trim();
  if (!token) {
    throw new Error("Not connected to GitHub");
  }
  return token;
}

function buildGitHubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function fetchCompanyRepos(
  githubOrgName: string
): Promise<{ org: string; repos: CompanyRepoInput[] }> {
  const org = parseGithubOrgName(githubOrgName);
  console.info("[opensource] fetchCompanyRepos:start", {
    githubOrgName,
    parsedOrg: org,
  });
  const token = await getGitHubAuthToken();
  const user = await getCurrentUser(token);
  console.info("[opensource] fetchCompanyRepos:resolved-user", {
    githubUserId: user.id,
    githubLogin: user.login,
  });
  await upsertGitHubConnection(user.id, user.login, token);

  const endpoint = `https://api.github.com/users/${encodeURIComponent(org)}/repos?per_page=100&type=public&sort=updated`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: buildGitHubHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("[opensource] fetchCompanyRepos:github-error", {
      org,
      status: response.status,
      statusText: response.statusText,
    });
    if (response.status === 404) {
      throw new Error(`GitHub organization "${org}" was not found`);
    }
    if (response.status === 401) {
      throw new Error("GitHub authentication failed. Reconnect your account.");
    }
    if (response.status === 403) {
      throw new Error("GitHub API rate-limited or forbidden for this token.");
    }
    const body = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as GitHubRepoApiItem[];
  const repos: CompanyRepoInput[] = payload.map((repository) => ({
    name: repository.name,
    url: repository.html_url,
    primary_language: repository.language,
    is_open_source: !repository.private,
  }));
  console.info("[opensource] fetchCompanyRepos:success", {
    org,
    fetchedCount: repos.length,
  });

  return { org, repos };
}

export async function syncReposToSupabase(
  companyId: string,
  repos: CompanyRepoInput[]
): Promise<{ syncedCount: number }> {
  console.info("[opensource] syncReposToSupabase:start", {
    companyId,
    incomingCount: Array.isArray(repos) ? repos.length : -1,
  });
  if (!companyId?.trim()) {
    throw new Error("Company ID is required");
  }
  if (!Array.isArray(repos)) {
    throw new Error("Expected an array of repositories");
  }
  const normalized: RepositoryUpsertInput[] = repos.map((repo) => ({
    name: repo.name,
    url: repo.url,
    primary_language: repo.primary_language,
    is_open_source: repo.is_open_source,
  }));
  const syncedCount = await upsertRepositoriesForCompany(companyId, normalized);
  console.info("[opensource] syncReposToSupabase:success", {
    companyId,
    syncedCount,
  });
  revalidatePath("/");
  return { syncedCount };
}

export async function listCompaniesAction(): Promise<CompanyRow[]> {
  return listCompanies();
}

export async function createCompanyAction(input: CompanyInsert): Promise<CompanyRow> {
  const company = await createCompany(input);
  revalidatePath("/");
  return company;
}
