import { TwitterApi } from "twitter-api-v2";
import { loadEnv } from "./env";

loadEnv();

function envTrim(name: string): string {
  const v = process.env[name];
  if (v == null || typeof v !== "string") return "";
  return v.trim().replace(/^["']|["']$/g, "");
}

/**
 * OAuth 1.0a user-context client (required for user mention timeline and posting replies).
 * Bearer-only apps cannot call GET /2/users/:id/mentions.
 */
export function getTwitterClientOAuthUser(): TwitterApi | null {
  const appKey = envTrim("X_API_KEY");
  const appSecret =
    envTrim("X_API_SECRET") || envTrim("x_API_SECRET");
  const accessToken = envTrim("X_ACCESS_TOKEN");
  const accessSecret = envTrim("X_ACCESS_TOKEN_SECRET");
  if (appKey && appSecret && accessToken && accessSecret) {
    return new TwitterApi({
      appKey,
      appSecret,
      accessToken,
      accessSecret,
    });
  }
  return null;
}

/**
 * Post a reply on X (v2). Requires OAuth user context with write scope.
 */
export async function postReplyToTweet(
  inReplyToTweetId: string,
  text: string
): Promise<string> {
  const client = getTwitterClientOAuthUser();
  if (!client) {
    throw new Error(
      "X OAuth not configured (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET)"
    );
  }
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Reply text is empty");
  if (trimmed.length > 280) {
    throw new Error("Reply exceeds 280 characters");
  }
  const rw = client.readWrite;
  const res = await rw.v2.tweet({
    text: trimmed,
    reply: { in_reply_to_tweet_id: inReplyToTweetId },
  });
  const id = res.data?.id;
  if (!id) {
    throw new Error("X API returned no tweet id");
  }
  return id;
}
