import type { TweetV2 } from "twitter-api-v2";
import { TwitterApi } from "twitter-api-v2";
import { loadEnv } from "./env";

loadEnv();

export interface DiscoveredTweet {
  tweet_id: string;
  text: string;
  author_username: string;
  like_count: number;
  created_at: string;
  post_url: string;
}

function envTrim(name: string): string {
  const v = process.env[name];
  if (v == null || typeof v !== "string") return "";
  return v.trim().replace(/^["']|["']$/g, "");
}

export function getTwitterClientForSearch(): TwitterApi | null {
  const bearer = envTrim("X_BEARER_TOKEN");
  if (bearer) {
    return new TwitterApi(bearer);
  }
  const appKey = envTrim("X_API_KEY");
  const appSecret = envTrim("X_API_SECRET");
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

/** Append -from:user so your own posts are excluded when X_OWN_USERNAME is set */
export function augmentQueryForExcludeSelf(queryString: string): string {
  const raw = envTrim("X_OWN_USERNAME").replace(/^@/, "");
  if (!raw) return queryString.trim();
  const q = queryString.trim();
  if (q.includes(`-from:${raw}`)) return q;
  return `(${q}) -from:${raw}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Skip tweets authored by you or whose text mentions your handle (RTs, threads, etc.).
 * Uses X_OWN_USERNAME (with or without @). No-op if unset.
 */
export function shouldSkipTweetForSelf(tweet: DiscoveredTweet): boolean {
  const raw = envTrim("X_OWN_USERNAME").replace(/^@/, "");
  if (!raw) return false;
  if (tweet.author_username.toLowerCase() === raw.toLowerCase()) return true;
  const mention = new RegExp(`@?${escapeRegex(raw)}\\b`, "i");
  return mention.test(tweet.text);
}

function tweetToDiscovered(
  t: TweetV2,
  username: string
): DiscoveredTweet {
  const metrics = t.public_metrics;
  const likes = metrics?.like_count ?? 0;
  const created = t.created_at || new Date().toISOString();
  return {
    tweet_id: t.id,
    text: t.text || "",
    author_username: username,
    like_count: likes,
    created_at: created,
    post_url: `https://x.com/${username}/status/${t.id}`,
  };
}

/**
 * One X API recent search. max_results 20 per PRD.
 */
export async function searchRecentTweets(
  queryString: string
): Promise<{ tweets: DiscoveredTweet[]; error?: string }> {
  const client = getTwitterClientForSearch();
  if (!client) {
    return {
      tweets: [],
      error:
        "X API not configured: set X_BEARER_TOKEN or X OAuth credentials (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET).",
    };
  }
  const q = augmentQueryForExcludeSelf(queryString);
  try {
    const paginator = await client.v2.search(q, {
      max_results: 20,
      "tweet.fields": ["created_at", "public_metrics", "author_id"],
      expansions: ["author_id"],
      "user.fields": ["username"],
    });
    const out: DiscoveredTweet[] = [];
    for (const t of paginator.tweets) {
      const author = paginator.includes.author(t);
      const username = author?.username ?? "unknown";
      out.push(tweetToDiscovered(t, username));
    }
    return { tweets: out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("x-discovery search error:", msg);
    return { tweets: [], error: msg };
  }
}
