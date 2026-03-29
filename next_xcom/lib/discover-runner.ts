import { supabase } from "./supabase";
import { generateReplyForPost } from "./grok-reply";
import { searchRecentTweets, type DiscoveredTweet } from "./x-discovery";
import {
  countTodayNonRejected,
  getDailyCap,
  setReplyAutomationMeta,
} from "./reply-automation";

const BATCH_MAX = 5;

/**
 * Tweets that push joining Telegram/Discord/WhatsApp, newsletters, or other off-X funnels.
 * Discovery skips these so we do not draft replies that encourage that engagement style.
 * Disable with X_ENGAGER_DISCOVERY_SKIP_OFFPLATFORM=0
 */
export function tweetLooksLikeOffPlatformCta(text: string): boolean {
  const t = text;
  if (/https?:\/\/t\.me\//i.test(t)) return true;
  if (/https?:\/\/(www\.)?telegram\.me\//i.test(t)) return true;
  if (/https?:\/\/discord\.(gg|com\/invite)/i.test(t)) return true;
  if (/https?:\/\/(www\.)?whatsapp\.com\//i.test(t)) return true;
  if (/https?:\/\/join\.slack\.com\//i.test(t)) return true;
  if (/\bt\.me\/[\w/]+/i.test(t)) return true;
  if (/join\s+(us\s+)?on\s+(tg|telegram|discord|whatsapp|signal)\b/i.test(t))
    return true;
  if (/come\s+with\s+us\s+on\s+tg\b/i.test(t)) return true;
  if (/\bon\s+tg\s*:/i.test(t)) return true;
  if (/subscribe\s+(to\s+)?(our\s+)?(newsletter|mailing\s+list)\b/i.test(t))
    return true;
  if (/\bnewsletter\b.*\b(link\s+in\s+bio|sign\s+up|subscribe)\b/i.test(t))
    return true;
  if (/\bdm\s+me\s+(for|to\s+join)\b/i.test(t)) return true;
  if (/join\s+(our\s+)?(telegram|discord|tg\b|waitlist)\b/i.test(t))
    return true;
  return false;
}

function isOffPlatformCtaFilterEnabled(): boolean {
  const v = process.env.X_ENGAGER_DISCOVERY_SKIP_OFFPLATFORM?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return true;
}

/** Optional: skip tweets whose text matches this regex (e.g. news/geopolitics) before Grok. */
function getDiscoverySkipRegex(): RegExp | null {
  const raw = process.env.X_ENGAGER_DISCOVERY_SKIP_REGEX?.trim();
  if (!raw) return null;
  try {
    return new RegExp(raw, "i");
  } catch {
    console.warn(
      "[discover-runner] invalid X_ENGAGER_DISCOVERY_SKIP_REGEX — ignoring"
    );
    return null;
  }
}

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
  /** Unique tweets returned by X recent search (after dedupe), before Grok/insert */
  candidateCount: number;
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
      candidateCount: 0,
    };
  }

  const dailyCount = await countTodayNonRejected();
  const cap = getDailyCap();
  console.log("[discover-runner] IST day so far (non-rejected):", dailyCount, "/", cap);
  if (dailyCount >= cap) {
    console.log("[discover-runner] skip: daily cap already reached");
    return {
      inserted: 0,
      skippedDueToCap: true,
      errors: [],
      batch,
      dailyCountBefore: dailyCount,
      candidateCount: 0,
    };
  }

  const slots = Math.min(BATCH_MAX, cap - dailyCount);
  console.log("[discover-runner] will try up to", slots, "new inserts this run");

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
      candidateCount: 0,
    };
  }

  if (!queries?.length) {
    console.log("[discover-runner] no active search_queries rows");
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
      candidateCount: 0,
    };
  }

  console.log("[discover-runner] active queries:", queries.length, queries.map((q) => q.name).join(", "));

  const allTweets: DiscoveredTweet[] = [];
  for (const row of queries) {
    const qs = String(row.query_string);
    const { tweets, error } = await searchRecentTweets(qs);
    if (error) errors.push(`${row.name}: ${error}`);
    allTweets.push(...tweets);
  }

  const candidates = dedupeAndSort(allTweets);
  console.log("[discover-runner] tweets from X (after dedupe):", candidates.length);

  const skipRegex = getDiscoverySkipRegex();
  let skippedByFilter = 0;
  let skippedOffPlatformCta = 0;
  const offPlatformOn = isOffPlatformCtaFilterEnabled();

  let inserted = 0;
  let grokIndex = 0;

  for (const tweet of candidates) {
    if (inserted >= slots) break;

    if (skipRegex?.test(tweet.text)) {
      skippedByFilter++;
      continue;
    }

    if (offPlatformOn && tweetLooksLikeOffPlatformCta(tweet.text)) {
      skippedOffPlatformCta++;
      continue;
    }

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

  if (skippedByFilter > 0) {
    console.log(
      "[discover-runner] skipped by X_ENGAGER_DISCOVERY_SKIP_REGEX:",
      skippedByFilter
    );
  }
  if (skippedOffPlatformCta > 0) {
    console.log(
      "[discover-runner] skipped off-platform / join CTA tweets:",
      skippedOffPlatformCta
    );
  }

  const lastErr = errors.length ? errors.join("; ").slice(0, 2000) : null;
  console.log("[discover-runner] finished inserted:", inserted, "errors:", errors.length);
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
    candidateCount: candidates.length,
  };
}
