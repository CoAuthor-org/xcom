import { NextResponse } from "next/server";
import { getGitHubAuthUrl, isGitHubConfigured } from "@/lib/github";

export async function GET() {
  if (!isGitHubConfigured()) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET." },
      { status: 503 }
    );
  }
  const url = getGitHubAuthUrl();
  return NextResponse.redirect(url);
}
