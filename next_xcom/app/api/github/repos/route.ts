import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listUserRepos } from "@/lib/github";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("github_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not connected to GitHub" }, { status: 401 });
  }
  try {
    const repos = await listUserRepos(token);
    return NextResponse.json({
      repos: repos.map((r) => ({
        full_name: r.full_name,
        name: r.name,
        owner: r.owner.login,
        private: r.private,
        default_branch: r.default_branch,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to list repos";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
