import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { fetchGithubHelpWantedRepos } from "@/lib/scouter/github";
import { upsertRepo } from "@/lib/scouter/supabase";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim() || process.env.SCOUTER_CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const querySecret = new URL(request.url).searchParams.get("secret")?.trim();
  return bearer === secret || querySecret === secret;
}

export async function GET(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const err = requireSupabaseStorage();
  if (err) return NextResponse.json({ error: err.error }, { status: 503 });
  try {
    const repos = await fetchGithubHelpWantedRepos();
    let saved = 0;
    const errors: string[] = [];
    for (const repo of repos) {
      try {
        await upsertRepo(repo);
        saved++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${repo.repo_name}: ${msg}`);
      }
    }
    return NextResponse.json({
      ok: true,
      fetched: repos.length,
      saved,
      errors,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
