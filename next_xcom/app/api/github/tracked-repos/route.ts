import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isBlogGithubDbConfigured,
  listTrackedReposForUser,
  setTrackedReposForUser,
  upsertGitHubConnection,
} from "@/lib/blog-github-db";
import { getCurrentUser } from "@/lib/github";

export async function GET() {
  if (!isBlogGithubDbConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured", tracked: [] },
      { status: 503 }
    );
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("github_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not connected to GitHub" }, { status: 401 });
  }
  try {
    const user = await getCurrentUser(token);
    await upsertGitHubConnection(user.id, user.login, token);
    const tracked = await listTrackedReposForUser(user.id);
    return NextResponse.json({
      tracked: tracked.map((t) => ({
        id: t.id,
        full_name: t.full_name,
        branch_filter: t.branch_filter,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load tracked repos";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isBlogGithubDbConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("github_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not connected to GitHub" }, { status: 401 });
  }
  let body: { tracked?: unknown };
  try {
    body = (await request.json()) as { tracked?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = body.tracked;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "Expected { tracked: string[] }" }, { status: 400 });
  }
  const fullNames = raw.filter((x): x is string => typeof x === "string");
  try {
    const user = await getCurrentUser(token);
    await upsertGitHubConnection(user.id, user.login, token);
    await setTrackedReposForUser(user.id, fullNames);
    const tracked = await listTrackedReposForUser(user.id);
    return NextResponse.json({
      ok: true,
      tracked: tracked.map((t) => ({
        id: t.id,
        full_name: t.full_name,
        branch_filter: t.branch_filter,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
