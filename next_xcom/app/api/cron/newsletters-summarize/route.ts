import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { newslettersDbAvailable } from "@/lib/newsletters/db";
import { runNewsletterBatchSummarize } from "@/lib/newsletters/batch-runner";

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const url = new URL(request.url);
  const q = url.searchParams.get("secret");
  return bearer === secret || q === secret;
}

async function handleSummarize(req: Request) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const storageErr = requireSupabaseStorage();
  if (storageErr) {
    return NextResponse.json({ error: storageErr.error }, { status: 503 });
  }
  if (!newslettersDbAvailable()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const result = await runNewsletterBatchSummarize();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  if (result.skipped) {
    return NextResponse.json({ ok: true, skipped: true, message: result.message });
  }
  return NextResponse.json({
    ok: true,
    digestId: result.digestId,
    emailCount: result.emailCount,
    periodStart: result.periodStart,
    periodEnd: result.periodEnd,
  });
}

export async function GET(request: Request) {
  return handleSummarize(request);
}

export async function POST(request: Request) {
  return handleSummarize(request);
}
