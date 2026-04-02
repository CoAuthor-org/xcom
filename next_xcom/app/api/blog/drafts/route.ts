import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isBlogGithubDbConfigured,
  listBlogCommitDrafts,
  upsertGitHubConnection,
} from "@/lib/blog-github-db";
import { getCurrentUser } from "@/lib/github";

export async function GET(request: Request) {
  if (!isBlogGithubDbConfigured()) {
    return NextResponse.json({ error: "Supabase not configured", drafts: [] }, { status: 503 });
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("github_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not connected to GitHub" }, { status: 401 });
  }
  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 50));
  try {
    const user = await getCurrentUser(token);
    await upsertGitHubConnection(user.id, user.login, token);
    const drafts = await listBlogCommitDrafts(user.id, limit);
    return NextResponse.json({ drafts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to list drafts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
