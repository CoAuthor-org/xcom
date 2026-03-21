import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/github";

const GITHUB_TOKEN_COOKIE = "github_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?github_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/?github_error=missing_code", request.url)
    );
  }

  try {
    const token = await exchangeCodeForToken(code);
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(GITHUB_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Auth failed";
    return NextResponse.redirect(
      new URL(`/?github_error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
