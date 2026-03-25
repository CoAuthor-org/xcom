import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { runDiscoverPosts } from "@/lib/discover-runner";
import { isInitialized } from "@/lib/llm";
import { getTwitterClientForSearch } from "@/lib/x-discovery";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const url = new URL(request.url);
  const q = url.searchParams.get("secret");
  return bearer === secret || q === secret;
}

async function handleDiscover(request: Request) {
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
  if (!getTwitterClientForSearch()) {
    return NextResponse.json(
      { error: "X API not configured for search (bearer or OAuth)" },
      { status: 503 }
    );
  }
  const url = new URL(request.url);
  const batch = url.searchParams.get("batch");
  try {
    const result = await runDiscoverPosts({ batch });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("discover-posts:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Vercel Cron invokes GET; manual runs may use POST */
export async function GET(request: Request) {
  return handleDiscover(request);
}

export async function POST(request: Request) {
  return handleDiscover(request);
}
