import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { fetchLeadFeeds } from "@/lib/scouter/rss";
import { isScouterLlmEnabled, scoreOpportunity } from "@/lib/scouter/grok";
import { upsertOpportunity } from "@/lib/scouter/supabase";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim() || process.env.SCOUTER_CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const querySecret = new URL(request.url).searchParams.get("secret")?.trim();
  return bearer === secret || querySecret === secret;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function GET(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const err = requireSupabaseStorage();
  if (err) return NextResponse.json({ error: err.error }, { status: 503 });
  if (!isScouterLlmEnabled()) {
    return NextResponse.json(
      { error: "Grok not configured (set XAI_API_KEY or GROK_API_KEY)" },
      { status: 503 }
    );
  }

  try {
    const sourceList =
      process.env.SCOUTER_LEAD_FEEDS?.split(",").map((s) => s.trim()).filter(Boolean) ??
      [];
    const feeds = await fetchLeadFeeds(sourceList);
    const limited = feeds.slice(0, 25);

    let processed = 0;
    const errors: string[] = [];
    for (const item of limited) {
      const description = `${item.title}\n\n${item.description}\n\nSource: ${item.link}`;
      try {
        const scored = await scoreOpportunity(description);
        const domain = domainFromUrl(item.link);
        await upsertOpportunity({
          company_name: item.title.slice(0, 160),
          domain,
          description: description.slice(0, 4000),
          source: item.source,
          match_score: scored.match_score,
          outreach_draft: scored.outreach_draft,
        });
        processed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${item.title}: ${msg}`);
      }
    }

    return NextResponse.json({
      ok: true,
      fetched: feeds.length,
      processed,
      errors,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
