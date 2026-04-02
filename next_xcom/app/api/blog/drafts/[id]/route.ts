import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isBlogGithubDbConfigured,
  updateBlogCommitDraft,
  upsertGitHubConnection,
  type BlogCommitDraftStatus,
} from "@/lib/blog-github-db";
import { getCurrentUser } from "@/lib/github";

const ALLOWED: BlogCommitDraftStatus[] = [
  "pending",
  "approved",
  "rejected",
  "published",
];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isBlogGithubDbConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("github_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not connected to GitHub" }, { status: 401 });
  }
  let body: { generated_text?: unknown; status?: unknown };
  try {
    body = (await request.json()) as { generated_text?: unknown; status?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch: { generated_text?: string; status?: BlogCommitDraftStatus } = {};
  if (typeof body.generated_text === "string") {
    patch.generated_text = body.generated_text;
  }
  if (typeof body.status === "string" && ALLOWED.includes(body.status as BlogCommitDraftStatus)) {
    patch.status = body.status as BlogCommitDraftStatus;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }
  try {
    const user = await getCurrentUser(token);
    await upsertGitHubConnection(user.id, user.login, token);
    const draft = await updateBlogCommitDraft(id, user.id, patch);
    if (!draft) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ draft });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
