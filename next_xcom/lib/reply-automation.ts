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

export async function getReplyAutomationMeta(
  client: SupabaseClient | null = supabase
): Promise<{
  last_discover_at: string | null;
  last_discover_error: string | null;
}> {
  if (!client) {
    return { last_discover_at: null, last_discover_error: null };
  }
  const { data, error } = await client
    .from("reply_automation_meta")
    .select("last_discover_at, last_discover_error")
    .eq("singleton", 1)
    .maybeSingle();
  if (error || !data) {
    return { last_discover_at: null, last_discover_error: null };
  }
  return {
    last_discover_at: data.last_discover_at as string | null,
    last_discover_error: data.last_discover_error as string | null,
  };
}

export async function setReplyAutomationMeta(
  patch: {
    last_discover_at?: string | null;
    last_discover_error?: string | null;
  },
  client: SupabaseClient | null = supabase
): Promise<void> {
  if (!client) return;
  await client.from("reply_automation_meta").upsert(
    { singleton: 1, ...patch },
    { onConflict: "singleton" }
  );
}
