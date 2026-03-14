import fs from "fs";
import path from "path";
import { supabase, supabaseStatus, TWEET_IMAGES_BUCKET } from "./supabase";
import { getProjectRoot } from "./env";

const projectRoot = getProjectRoot();
const dataPath = path.join(projectRoot, "data.json");
const isProduction = process.env.NODE_ENV === "production";

export interface Entry {
  id: string;
  text: string;
  timestamp?: string;
  topicRef?: string;
  part?: number;
  imageUrl?: string;
  postedAt?: string;
  queue?: string;
}

function rowToEntry(row: Record<string, unknown>): Entry {
  return {
    id: String(row.id),
    text: String(row.text),
    timestamp: row.created_at as string,
    topicRef: (row.topic_ref as string) ?? undefined,
    part: (row.part as number) ?? undefined,
    imageUrl: (row.image_url as string) ?? undefined,
    postedAt: (row.posted_at as string) ?? undefined,
    queue: (row.queue as string) ?? undefined,
  };
}

export function requireSupabaseStorage(): { error: string } | null {
  if (isProduction && !supabase) {
    return {
      error:
        "Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in production.",
    };
  }
  return null;
}

export async function getEntries(): Promise<Entry[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("entries")
      .select("id, text, created_at, topic_ref, part, image_url, posted_at, queue")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToEntry);
  }
  if (fs.existsSync(dataPath)) {
    try {
      const fileContent = fs.readFileSync(dataPath, "utf8");
      if (fileContent.trim()) {
        const data = JSON.parse(fileContent) as { entries: Array<Record<string, unknown>> };
        return (data.entries || []).map((e, i) => ({
          id: String(i),
          ...e,
          imageUrl: (e.imageUrl as string) ?? undefined,
        })) as Entry[];
      }
    } catch (e) {
      console.error("Error reading data.json:", e);
    }
  }
  return [];
}

export async function insertEntry(entry: {
  text: string;
  topicRef?: string | null;
  part?: number | null;
  imageUrl?: string | null;
  queue?: string | null;
}): Promise<Entry> {
  if (supabase) {
    const { data, error } = await supabase
      .from("entries")
      .insert({
        text: entry.text,
        topic_ref: entry.topicRef ?? null,
        part: entry.part ?? null,
        image_url: entry.imageUrl ?? null,
        queue: entry.queue ?? null,
      })
      .select("id, text, created_at, topic_ref, part, image_url, posted_at, queue")
      .single();
    if (error) throw error;
    return rowToEntry(data);
  }
  const data = fs.existsSync(dataPath)
    ? (JSON.parse(fs.readFileSync(dataPath, "utf8")) as { entries: Array<Record<string, unknown>> })
    : { entries: [] };
  const newEntry: Record<string, unknown> = {
    text: entry.text,
    timestamp: new Date().toISOString(),
  };
  if (entry.topicRef != null) newEntry.topicRef = entry.topicRef;
  if (entry.part != null) newEntry.part = entry.part;
  data.entries.push(newEntry);
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  return {
    id: String(data.entries.length - 1),
    ...newEntry,
  } as Entry;
}

export async function updateEntryById(
  id: string,
  text: string
): Promise<Entry | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from("entries")
      .update({ text })
      .eq("id", id)
      .select("id, text, created_at, topic_ref, part, image_url, posted_at, queue")
      .single();
    if (error) throw error;
    return data ? rowToEntry(data) : null;
  }
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8")) as {
    entries: Array<Record<string, unknown>>;
  };
  const index = parseInt(id, 10);
  if (Number.isNaN(index) || index < 0 || index >= data.entries.length)
    return null;
  data.entries[index].text = text;
  data.entries[index].timestamp = new Date().toISOString();
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  return { id: String(index), ...data.entries[index] } as Entry;
}

export async function updateEntryQueueById(
  id: string,
  queue: string
): Promise<Entry | null> {
  if (supabase) {
    const value = queue === "10am" || queue === "6pm" ? queue : null;
    const { data, error } = await supabase
      .from("entries")
      .update({ queue: value })
      .eq("id", id)
      .select("id, text, created_at, topic_ref, part, image_url, posted_at, queue")
      .single();
    if (error) throw error;
    return data ? rowToEntry(data) : null;
  }
  return null;
}

export async function deleteEntryById(id: string): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase.from("entries").delete().eq("id", id);
    if (error) throw error;
    return true;
  }
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8")) as {
    entries: Array<Record<string, unknown>>;
  };
  const index = parseInt(id, 10);
  if (Number.isNaN(index) || index < 0 || index >= data.entries.length)
    return false;
  data.entries.splice(index, 1);
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  return true;
}

export async function deleteAllEntries(): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase
      .from("entries")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw error;
    return true;
  }
  fs.writeFileSync(dataPath, JSON.stringify({ entries: [] }, null, 2));
  return true;
}

export function formatSupabaseError(e: { message?: string; details?: string; hint?: string; code?: string }): string {
  const msg = e.message || String(e);
  const details = e.details || e.hint || (e.code ? `code: ${e.code}` : "");
  return details ? `${msg} — ${details}` : msg;
}

export { supabaseStatus, TWEET_IMAGES_BUCKET };
