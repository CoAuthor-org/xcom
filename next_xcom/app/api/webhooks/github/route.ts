import { NextResponse } from "next/server";
import {
  processGitHubPushPayload,
  verifyGithubWebhookSignature,
} from "@/lib/blog-github-sync";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "GITHUB_WEBHOOK_SECRET is not configured" },
      { status: 503 }
    );
  }
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 }
    );
  }

  const sig = request.headers.get("x-hub-signature-256");
  const raw = await request.text();
  if (!verifyGithubWebhookSignature(secret, raw, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  if (event !== "push") {
    return NextResponse.json({ ok: true, ignored: event });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await processGitHubPushPayload(raw, payload);
  return NextResponse.json(result);
}
