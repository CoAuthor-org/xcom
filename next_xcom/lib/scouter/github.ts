export interface ScouterGithubRepoCandidate {
  repo_name: string;
  url: string;
  language: string;
  issue_title: string;
  community_link: string | null;
}

const SEARCH_LANGUAGE_TAGS = ["Rust", "TypeScript", "Go"];

function getGithubToken(): string {
  return (
    process.env.SCOUTER_GITHUB_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GITHUB_ACCESS_TOKEN?.trim() ||
    ""
  );
}

function maybeCommunityLink(text: string): string | null {
  const match = text.match(
    /(https?:\/\/(?:discord\.gg|discord\.com\/invite|slack\.com\/[^\s"')]+)[^\s"')]*)/i
  );
  return match ? match[1] : null;
}

async function fetchReadmeSnippet(token: string, owner: string, repo: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "xcom-scouter",
    },
  });
  if (!res.ok) return "";
  const body = await res.text();
  return body.slice(0, 20000);
}

export async function fetchGithubHelpWantedRepos(): Promise<ScouterGithubRepoCandidate[]> {
  const token = getGithubToken();
  if (!token) {
    throw new Error(
      "GitHub token missing. Set SCOUTER_GITHUB_TOKEN (or GITHUB_TOKEN/GITHUB_ACCESS_TOKEN)."
    );
  }

  const query = `
    query SearchRepos($q: String!) {
      search(type: ISSUE, query: $q, first: 20) {
        nodes {
          ... on Issue {
            title
            repository {
              nameWithOwner
              url
              primaryLanguage {
                name
              }
              owner {
                login
              }
              name
            }
          }
        }
      }
    }
  `;

  const q =
    '(label:"good first issue" OR label:"help wanted") is:open is:issue archived:false ' +
    SEARCH_LANGUAGE_TAGS.map((l) => `language:${l}`).join(" ");

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "xcom-scouter",
    },
    body: JSON.stringify({
      query,
      variables: { q },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub GraphQL failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as {
    data?: {
      search?: {
        nodes?: Array<{
          title?: string;
          repository?: {
            nameWithOwner?: string;
            url?: string;
            primaryLanguage?: { name?: string | null } | null;
            owner?: { login?: string };
            name?: string;
          };
        }>;
      };
    };
  };

  const nodes = json.data?.search?.nodes || [];
  const rows: ScouterGithubRepoCandidate[] = [];
  for (const node of nodes) {
    const repo = node.repository;
    const name = repo?.nameWithOwner?.trim() || "";
    const url = repo?.url?.trim() || "";
    const issueTitle = node.title?.trim() || "";
    if (!name || !url || !issueTitle) continue;
    const language = repo?.primaryLanguage?.name?.trim() || "unknown";
    let community: string | null = null;
    const owner = repo?.owner?.login?.trim();
    const repoName = repo?.name?.trim();
    if (owner && repoName) {
      const readme = await fetchReadmeSnippet(token, owner, repoName);
      community = maybeCommunityLink(readme);
    }
    rows.push({
      repo_name: name,
      url,
      language,
      issue_title: issueTitle,
      community_link: community,
    });
  }

  return rows;
}
