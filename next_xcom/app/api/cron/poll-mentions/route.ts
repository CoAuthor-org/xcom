import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { isInitialized } from "@/lib/llm";
import { runPollMentions } from "@/lib/poll-mentions-runner";
import { getTwitterClientOAuthUser } from "@/lib/x-twitter-user";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const url = new URL(request.url);
  const q = url.searchParams.get("secret");
  return bearer === secret || q === secret;
}

async function handlePoll(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  if (!isInitialized()) {
    return NextResponse.json(
      { error: "Grok not configured (set XAI_API_KEY or GROK_API_KEY)" },
      { status: 503 }
    );
  }
  if (!getTwitterClientOAuthUser()) {
    return NextResponse.json(
      {
        error:
          "X OAuth user context required for mentions (not bearer-only). Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.",
      },
      { status: 503 }
    );
  }
  try {
    const result = await runPollMentions();
    console.log("[poll-mentions]", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("poll-mentions:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handlePoll(request);
}

export async function POST(request: Request) {
  return handlePoll(request);
}
