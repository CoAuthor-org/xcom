import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteGitHubConnection } from "@/lib/blog-github-db";
import { getCurrentUser } from "@/lib/github";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("github_token")?.value;
  if (token) {
    try {
      const user = await getCurrentUser(token);
      await deleteGitHubConnection(user.id);
    } catch {
      // ignore
    }
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set("github_token", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
