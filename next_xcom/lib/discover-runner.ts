import { supabase } from "./supabase";
import { generateReplyForPost } from "./grok-reply";
import { searchRecentTweets, type DiscoveredTweet } from "./x-discovery";
import {
  countTodayNonRejected,
  getDailyCap,
  setReplyAutomationMeta,
} from "./reply-automation";

const BATCH_MAX = 5;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function dedupeAndSort(tweets: DiscoveredTweet[]): DiscoveredTweet[] {
  const byId = new Map<string, DiscoveredTweet>();
  for (const t of tweets) {
    const prev = byId.get(t.tweet_id);
    if (!prev || t.like_count > prev.like_count) {
      byId.set(t.tweet_id, t);
    }
  }
  const list = [...byId.values()];
  list.sort((a, b) => {
    if (b.like_count !== a.like_count) return b.like_count - a.like_count;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return list;
}

export interface DiscoverResult {
  inserted: number;
  skippedDueToCap: boolean;
  errors: string[];
  batch: string;
  dailyCountBefore: number;
}

export async function runDiscoverPosts(opts: {
  batch?: string | null;
}): Promise<DiscoverResult> {
  const batch = opts.batch ?? "manual";
  const errors: string[] = [] as string[];

  if (!supabase) {
    return {
      inserted: 0,
      skippedDueToCap: true,
      errors: ["Supabase not configured"],
      batch,
      dailyCountBefore: 0,
    };
  }

  const dailyCount = await countTodayNonRejected();
  const cap = getDailyCap();
  if (dailyCount >= cap) {
    return {
      inserted: 0,
      skippedDueToCap: true,
      errors: [],
      batch,
      dailyCountBefore: dailyCount,
    };
  }

  const slots = Math.min(BATCH_MAX, cap - dailyCount);

  const { data: queries, error: qErr } = await supabase
    .from("search_queries")
    .select("id, name, query_string")
    .eq("is_active", true);

  if (qErr) {
    console.error("search_queries:", qErr.message);
    const msg = qErr.message;
    await setReplyAutomationMeta({
      last_discover_at: new Date().toISOString(),
      last_discover_error: msg,
    });
    return {
      inserted: 0,
      skippedDueToCap: false,
      errors: [msg],
      batch,
      dailyCountBefore: dailyCount,
    };
  }

  if (!queries?.length) {
    await setReplyAutomationMeta({
      last_discover_at: new Date().toISOString(),
      last_discover_error: "No active search queries",
    });
    return {
      inserted: 0,
      skippedDueToCap: false,
      errors: ["No active search queries"],
      batch,
      dailyCountBefore: dailyCount,
    };
  }

  const allTweets: DiscoveredTweet[] = [];
  for (const row of queries) {
    const qs = String(row.query_string);
    const { tweets, error } = await searchRecentTweets(qs);
    if (error) errors.push(`${row.name}: ${error}`);
    allTweets.push(...tweets);
  }

  const candidates = dedupeAndSort(allTweets);

  let inserted = 0;
  let grokIndex = 0;

  for (const tweet of candidates) {
    if (inserted >= slots) break;

    if (grokIndex > 0) await sleep(1000);
    grokIndex++;

    let generatedReply: string;
    try {
      const gen = await generateReplyForPost(tweet.text);
      generatedReply = gen.text;
      if (!generatedReply.trim()) {
        errors.push(`tweet ${tweet.tweet_id}: empty Grok reply`);
        continue;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`tweet ${tweet.tweet_id}: Grok ${msg}`);
      continue;
    }

    const { error: insErr } = await supabase.from("pending_replies").insert({
      tweet_id: tweet.tweet_id,
      original_text: tweet.text,
      author_username: tweet.author_username,
      post_url: tweet.post_url,
      generated_reply: generatedReply,
      status: "pending",
    });

    if (insErr) {
      if (insErr.code === "23505") {
        // duplicate tweet_id — skip
        continue;
      }
      errors.push(`insert ${tweet.tweet_id}: ${insErr.message}`);
      continue;
    }

    inserted++;
  }

  const lastErr = errors.length ? errors.join("; ").slice(0, 2000) : null;
  await setReplyAutomationMeta({
    last_discover_at: new Date().toISOString(),
    last_discover_error: lastErr,
  });

  return {
    inserted,
    skippedDueToCap: false,
    errors,
    batch,
    dailyCountBefore: dailyCount,
  };
}
