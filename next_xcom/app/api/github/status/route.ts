import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, isGitHubConfigured } from "@/lib/github";

export async function GET() {
  if (!isGitHubConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
      user: null,
    });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("github_token")?.value;

  if (!token) {
    return NextResponse.json({
      configured: true,
      connected: false,
      user: null,
    });
  }

  try {
    const user = await getCurrentUser(token);
    return NextResponse.json({
      configured: true,
      connected: true,
      user: { login: user.login },
    });
  } catch {
    return NextResponse.json({
      configured: true,
      connected: false,
      user: null,
    });
  }
}
