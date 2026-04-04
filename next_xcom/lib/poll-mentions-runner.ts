import type { TweetV2 } from "twitter-api-v2";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateReplyForInboundContext } from "./grok-reply";
import {
  getReplyAutomationMeta,
  setReplyAutomationMeta,
} from "./reply-automation";
import { supabase } from "./supabase";
import { searchRecentTweets } from "./x-discovery";
import { getTwitterClientOAuthUser } from "./x-twitter-user";

function envTrim(name: string): string {
  const v = process.env[name];
  if (v == null || typeof v !== "string") return "";
  return v.trim().replace(/^["']|["']$/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function maxSnowflakeId(ids: string[]): string | null {
  if (ids.length === 0) return null;
  return ids.reduce((a, b) => (BigInt(a) > BigInt(b) ? a : b));
}

function getInReplyToTweetId(t: TweetV2): string | null {
  const ref = t.referenced_tweets?.find((r) => r.type === "replied_to");
  return ref?.id ?? null;
}

function conversationSearchEnabled(): boolean {
  const v = envTrim("X_ENGAGER_INBOUND_CONVERSATION_SEARCH").toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

async function maybeConversationSummary(
  conversationId: string | undefined
): Promise<string | undefined> {
  if (!conversationSearchEnabled() || !conversationId?.trim()) {
    return undefined;
  }
  const q = `conversation_id:${conversationId.trim()}`;
  const { tweets, error } = await searchRecentTweets(q);
  if (error || tweets.length === 0) return undefined;
  return tweets
    .slice(0, 8)
    .map((tw) => `@${tw.author_username}: ${tw.text.replace(/\s+/g, " ").slice(0, 140)}`)
    .join("\n");
}

async function resolveMyUserId(
  client: ReturnType<typeof getTwitterClientOAuthUser>,
  sb: SupabaseClient,
  cachedMeta: string | null
): Promise<{ userId: string; cachedWrite?: string }> {
  const envId = envTrim("X_USER_ID");
  if (envId) return { userId: envId };
  if (cachedMeta) return { userId: cachedMeta };
  if (!client) throw new Error("No OAuth client for user id resolution");
  const me = await client.v2.me();
  const id = me.data.id;
  return { userId: id, cachedWrite: id };
}

export type PollMentionsResult = {
  inserted: number;
  fetched: number;
  skippedSelf: number;
  skippedExisting: number;
  errors: string[];
  newSinceId: string | null;
};

/**
 * Poll X user mention timeline, enqueue new mentions with Grok drafts.
 */
export async function runPollMentions(
  clientOverride: SupabaseClient | null = supabase
): Promise<PollMentionsResult> {
  const empty: PollMentionsResult = {
    inserted: 0,
    fetched: 0,
    skippedSelf: 0,
    skippedExisting: 0,
    errors: [],
    newSinceId: null,
  };

  if (!clientOverride) {
    empty.errors.push("Supabase not configured");
    return empty;
  }

  const xClient = getTwitterClientOAuthUser();
  if (!xClient) {
    empty.errors.push(
      "X OAuth user context required for mentions: set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET (bearer-only is not enough)."
    );
    await setReplyAutomationMeta(
      {
        last_mentions_poll_at: new Date().toISOString(),
        last_mentions_poll_error: empty.errors[0],
      },
      clientOverride
    );
    return empty;
  }

  const meta = await getReplyAutomationMeta(clientOverride);
  let myUserId: string;
  try {
    const resolved = await resolveMyUserId(xClient, clientOverride, meta.cached_x_user_id);
    myUserId = resolved.userId;
    if (resolved.cachedWrite) {
      await setReplyAutomationMeta(
        { cached_x_user_id: resolved.cachedWrite },
        clientOverride
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    empty.errors.push(`resolve user id: ${msg}`);
    await setReplyAutomationMeta(
      {
        last_mentions_poll_at: new Date().toISOString(),
        last_mentions_poll_error: msg.slice(0, 2000),
      },
      clientOverride
    );
    return empty;
  }

  const timelineOpts: Record<string, unknown> = {
    max_results: 50,
    expansions: ["author_id", "referenced_tweets.id", "in_reply_to_user_id"],
    "tweet.fields": [
      "created_at",
      "text",
      "conversation_id",
      "in_reply_to_user_id",
      "referenced_tweets",
      "author_id",
    ],
    "user.fields": ["username"],
  };
  if (meta.last_mentions_since_id?.trim()) {
    timelineOpts.since_id = meta.last_mentions_since_id.trim();
  }

  let paginator;
  try {
    paginator = await xClient.v2.userMentionTimeline(myUserId, timelineOpts);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    empty.errors.push(`mentions API: ${msg}`);
    await setReplyAutomationMeta(
      {
        last_mentions_poll_at: new Date().toISOString(),
        last_mentions_poll_error: msg.slice(0, 2000),
      },
      clientOverride
    );
    return empty;
  }

  const tweets = paginator.tweets;
  empty.fetched = tweets.length;
  const allIds = tweets.map((t) => t.id);
  empty.newSinceId = maxSnowflakeId(allIds);

  if (tweets.length === 0) {
    await setReplyAutomationMeta(
      {
        last_mentions_poll_at: new Date().toISOString(),
        last_mentions_poll_error: null,
      },
      clientOverride
    );
    return empty;
  }

  const { data: existingRows } = await clientOverride
    .from("incoming_mentions")
    .select("id")
    .in("id", allIds);
  const existingSet = new Set(
    (existingRows ?? []).map((r: { id: string }) => r.id)
  );

  let grokCalls = 0;

  for (const t of tweets) {
    const authorId = t.author_id ?? "";
    if (authorId === myUserId) {
      empty.skippedSelf++;
      continue;
    }
    if (existingSet.has(t.id)) {
      empty.skippedExisting++;
      continue;
    }

    const authorUser = paginator.includes.author(t);
    const authorUsername = authorUser?.username ?? "unknown";

    const inReplyToId = getInReplyToTweetId(t);
    const parentTweet = paginator.includes.repliedTo(t);

    const threadSummary = await maybeConversationSummary(t.conversation_id);

    const mentionUrl = `https://x.com/${authorUsername}/status/${t.id}`;
    const originalContext = {
      mention: {
        id: t.id,
        text: t.text ?? "",
        author_username: authorUsername,
        author_id: authorId,
        post_url: mentionUrl,
      },
      parent_tweet: parentTweet
        ? {
            id: parentTweet.id,
            text: parentTweet.text ?? "",
            author_id: parentTweet.author_id,
          }
        : null,
      conversation_id: t.conversation_id ?? null,
      in_reply_to_tweet_id: inReplyToId,
      thread_summary: threadSummary ?? null,
    };

    if (grokCalls > 0) await sleep(1000);
    grokCalls++;

    let grokSuggestion: string;
    try {
      const gen = await generateReplyForInboundContext({
        mentionAuthor: authorUsername,
        mentionText: t.text ?? "",
        parentTweetText: parentTweet?.text,
        threadSummary: threadSummary,
      });
      grokSuggestion = gen.text;
      if (!grokSuggestion.trim() || grokSuggestion.trim().length < 2) {
        empty.errors.push(`mention ${t.id}: empty Grok reply`);
        continue;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      empty.errors.push(`mention ${t.id}: Grok ${msg}`);
      continue;
    }

    const { error: insMentionErr } = await clientOverride
      .from("incoming_mentions")
      .insert({
        id: t.id,
        author_id: authorId || "unknown",
        author_username: authorUsername,
        text: t.text ?? "",
        conversation_id: t.conversation_id ?? null,
        in_reply_to_tweet_id: inReplyToId,
        in_reply_to_user_id: t.in_reply_to_user_id ?? null,
        referenced_tweets: t.referenced_tweets
          ? JSON.parse(JSON.stringify(t.referenced_tweets))
          : null,
        created_at: t.created_at ?? new Date().toISOString(),
        processed: true,
      });

    if (insMentionErr) {
      if (insMentionErr.code === "23505") {
        empty.skippedExisting++;
        continue;
      }
      empty.errors.push(`insert mention ${t.id}: ${insMentionErr.message}`);
      continue;
    }

    const { error: insQueueErr } = await clientOverride
      .from("inbound_reply_queue")
      .insert({
        mention_id: t.id,
        original_context: originalContext,
        grok_suggestion: grokSuggestion,
        edited_reply: null,
        status: "pending_review",
      });

    if (insQueueErr) {
      if (insQueueErr.code === "23505") {
        empty.skippedExisting++;
        continue;
      }
      empty.errors.push(`insert queue ${t.id}: ${insQueueErr.message}`);
      continue;
    }

    existingSet.add(t.id);
    empty.inserted++;
  }

  const pollErr =
    empty.errors.length > 0 ? empty.errors.join("; ").slice(0, 2000) : null;

  await setReplyAutomationMeta(
    {
      last_mentions_poll_at: new Date().toISOString(),
      last_mentions_poll_error: pollErr,
      ...(empty.newSinceId
        ? { last_mentions_since_id: empty.newSinceId }
        : {}),
    },
    clientOverride
  );

  return empty;
}
