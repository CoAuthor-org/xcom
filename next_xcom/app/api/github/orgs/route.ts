import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listOrgs } from "@/lib/github";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("github_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Not connected to GitHub" }, { status: 401 });
  }

  try {
    const orgs = await listOrgs(token);
    return NextResponse.json({ orgs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch orgs";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
