import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "./env";

loadEnv();

function envVar(name: string): string {
  const v = process.env[name];
  if (v == null || typeof v !== "string") return "";
  return v.trim().replace(/^["']|["']$/g, "");
}

const supabaseUrl = envVar("SUPABASE_URL");
const supabaseServiceKey =
  envVar("SUPABASE_SERVICE_ROLE_KEY") || envVar("SUPABASE_SERVICE_KEY");

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export function supabaseStatus(): {
  ok: boolean;
  url?: string;
  reason?: string;
} {
  if (supabase) {
    return {
      ok: true,
      url: supabaseUrl.replace(/^(https?:\/\/[^/]+).*/, "$1"),
    };
  }
  return {
    ok: false,
    reason: !supabaseUrl
      ? "SUPABASE_URL is missing or empty"
      : "SUPABASE_SERVICE_ROLE_KEY is missing or empty",
  };
}

export const TWEET_IMAGES_BUCKET = "tweet-images";
