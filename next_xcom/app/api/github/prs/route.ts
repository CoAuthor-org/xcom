import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, listPRsForOrg } from "@/lib/github";

export async function GET(request: NextRequest) {
  const org = request.nextUrl.searchParams.get("org");

  if (!org) {
    return NextResponse.json({ error: "Missing org parameter" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("github_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Not connected to GitHub" }, { status: 401 });
  }

  try {
    const user = await getCurrentUser(token);
    const prs = await listPRsForOrg(token, user.login, org);
    return NextResponse.json({ prs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch PRs";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
