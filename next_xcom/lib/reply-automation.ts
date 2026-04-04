import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const DAILY_CAP = 10;

/** Start of current calendar day and next midnight in Asia/Kolkata, as UTC Date objects */
export function getIstDayBoundsUtc(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) {
    throw new Error("IST date parts");
  }
  const dateStr = `${y}-${m}-${d}`;
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function getDailyCap(): number {
  return DAILY_CAP;
}

export async function countTodayNonRejected(
  client: SupabaseClient | null = supabase
): Promise<number> {
  if (!client) return 0;
  const { start, end } = getIstDayBoundsUtc();
  const { count, error } = await client
    .from("pending_replies")
    .select("*", { count: "exact", head: true })
    .neq("status", "rejected")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  if (error) {
    console.error("countTodayNonRejected:", error.message);
    return 0;
  }
  return count ?? 0;
}

const ENGAGED_STATUSES_FOR_AUTHOR_CAP = ["pending", "ready", "done"] as const;

/**
 * Usernames we already have a non-rejected pending reply for today (IST).
 * Used so discovery does not draft multiple replies to the same author the same day.
 */
export async function loadEngagedAuthorLowercaseSetToday(
  client: SupabaseClient | null = supabase
): Promise<Set<string>> {
  const empty = new Set<string>();
  if (!client) return empty;
  const { start, end } = getIstDayBoundsUtc();
  const { data, error } = await client
    .from("pending_replies")
    .select("author_username")
    .in("status", [...ENGAGED_STATUSES_FOR_AUTHOR_CAP])
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  if (error) {
    console.error("loadEngagedAuthorLowercaseSetToday:", error.message);
    return empty;
  }
  const set = new Set<string>();
  for (const row of data ?? []) {
    const u = String(
      (row as { author_username?: string }).author_username ?? ""
    ).toLowerCase();
    if (u) set.add(u);
  }
  return set;
}

export type ReplyAutomationMetaRow = {
  last_discover_at: string | null;
  last_discover_error: string | null;
  last_mentions_since_id: string | null;
  last_mentions_poll_at: string | null;
  last_mentions_poll_error: string | null;
  cached_x_user_id: string | null;
};

export async function getReplyAutomationMeta(
  client: SupabaseClient | null = supabase
): Promise<ReplyAutomationMetaRow> {
  const empty: ReplyAutomationMetaRow = {
    last_discover_at: null,
    last_discover_error: null,
    last_mentions_since_id: null,
    last_mentions_poll_at: null,
    last_mentions_poll_error: null,
    cached_x_user_id: null,
  };
  if (!client) {
    return empty;
  }
  const full = await client
    .from("reply_automation_meta")
    .select(
      "last_discover_at, last_discover_error, last_mentions_since_id, last_mentions_poll_at, last_mentions_poll_error, cached_x_user_id"
    )
    .eq("singleton", 1)
    .maybeSingle();

  if (full.error) {
    const code = (full.error as { code?: string }).code;
    if (code === "42703" || /column/i.test(full.error.message)) {
      const minimal = await client
        .from("reply_automation_meta")
        .select("last_discover_at, last_discover_error")
        .eq("singleton", 1)
        .maybeSingle();
      if (minimal.error || !minimal.data) return empty;
      const row = minimal.data as Record<string, unknown>;
      return {
        ...empty,
        last_discover_at: (row.last_discover_at as string | null) ?? null,
        last_discover_error: (row.last_discover_error as string | null) ?? null,
      };
    }
    return empty;
  }

  if (!full.data) {
    return empty;
  }
  const row = full.data as Record<string, unknown>;
  return {
    last_discover_at: (row.last_discover_at as string | null) ?? null,
    last_discover_error: (row.last_discover_error as string | null) ?? null,
    last_mentions_since_id: (row.last_mentions_since_id as string | null) ?? null,
    last_mentions_poll_at: (row.last_mentions_poll_at as string | null) ?? null,
    last_mentions_poll_error: (row.last_mentions_poll_error as string | null) ?? null,
    cached_x_user_id: (row.cached_x_user_id as string | null) ?? null,
  };
}

export async function setReplyAutomationMeta(
  patch: {
    last_discover_at?: string | null;
    last_discover_error?: string | null;
    last_mentions_since_id?: string | null;
    last_mentions_poll_at?: string | null;
    last_mentions_poll_error?: string | null;
    cached_x_user_id?: string | null;
  },
  client: SupabaseClient | null = supabase
): Promise<void> {
  if (!client) return;
  const { error } = await client.from("reply_automation_meta").upsert(
    { singleton: 1, ...patch },
    { onConflict: "singleton" }
  );
  if (error) {
    const onlyMentionKeys =
      Object.keys(patch).every((k) =>
        [
          "last_mentions_since_id",
          "last_mentions_poll_at",
          "last_mentions_poll_error",
          "cached_x_user_id",
        ].includes(k)
      );
    if (onlyMentionKeys && /column/i.test(error.message)) {
      console.warn(
        "setReplyAutomationMeta: inbound columns missing — apply migrations/012_inbound_engager.sql"
      );
      return;
    }
    console.error("setReplyAutomationMeta:", error.message);
  }
}
