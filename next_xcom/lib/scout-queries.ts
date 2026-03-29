import fs from "fs";
import path from "path";
import { getProjectRoot } from "./env";
import { generateText } from "./llm";
import { supabase } from "./supabase";
import {
  buildQueryStringFromOptions,
  defaultQueryOptions,
  type QueryOptionsV1,
} from "./x-query-assembler";

const projectRoot = getProjectRoot();

const PATH_FROM_TOPIC = path.join(
  projectRoot,
  "prompts",
  "scout-search-from-topic.prompt.txt"
);
const PATH_RECOMMEND = path.join(
  projectRoot,
  "prompts",
  "scout-topic-recommendations.prompt.txt"
);
const PATH_ROTATION = path.join(
  projectRoot,
  "prompts",
  "scout-rotation-topics.md"
);

const SCOUT_MODEL =
  process.env.SCOUT_GROK_MODEL?.trim() ||
  process.env.X_ENGAGER_GROK_MODEL?.trim() ||
  "grok-3-mini";

function loadFileSafe(p: string): string | null {
  try {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
  } catch {
    // ignore
  }
  return null;
}

export function loadScoutSearchFromTopicPrompt(): string | null {
  return loadFileSafe(PATH_FROM_TOPIC);
}

export function loadScoutTopicRecommendationsPrompt(): string | null {
  return loadFileSafe(PATH_RECOMMEND);
}

/** User-editable rotation / upcoming-weeks focus (markdown). */
export function loadScoutRotationTopics(): string {
  const raw = loadFileSafe(PATH_ROTATION);
  return raw ?? "";
}

function stripCodeFences(s: string): string {
  let t = s.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)```$/im;
  const m = t.match(fence);
  if (m) t = m[1].trim();
  return t;
}

export function parseJsonFromLlm<T>(raw: string): T | null {
  const t = stripCodeFences(raw);
  try {
    return JSON.parse(t) as T;
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

const ENTRY_SNIPPET_MAX = 320;
const ENTRY_ROWS_MAX = 45;

export async function fetchRecentEntryTextsForScout(): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("entries")
    .select("text")
    .order("created_at", { ascending: false })
    .limit(ENTRY_ROWS_MAX);
  if (error || !data?.length) return [];
  const out: string[] = [];
  for (const row of data) {
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text) continue;
    const snippet =
      text.length > ENTRY_SNIPPET_MAX
        ? `${text.slice(0, ENTRY_SNIPPET_MAX)}…`
        : text;
    out.push(snippet);
  }
  return out;
}

export interface ScoutFromTopicResult {
  name: string;
  query_string: string;
  query_options: QueryOptionsV1;
}

export interface ScoutSuggestion {
  label: string;
  rationale: string;
}

/** LLM JSON: new structured schema or legacy { name, query_string }. */
interface LlmScoutFromTopicPayload {
  name?: string;
  query_string?: string;
  all_words?: string[];
  exact_phrase?: string;
  any_words?: string[];
  lang?: string;
  suggested_min_faves?: number | null;
  suggested_min_retweets?: number | null;
  suggested_min_replies?: number | null;
  suggested_hashtags?: string[];
  suggested_replies_toggle?: boolean;
  suggested_replies_mode?: string;
  suggested_links_toggle?: boolean;
  suggested_links_mode?: string;
}

function normalizeStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function llmPayloadToOptions(
  p: LlmScoutFromTopicPayload,
  topicSeed: string
): QueryOptionsV1 {
  const o = defaultQueryOptions();
  o.allWords = normalizeStrArray(p.all_words);
  o.exactPhrase =
    typeof p.exact_phrase === "string" ? p.exact_phrase.trim() : "";
  if (!o.exactPhrase && topicSeed.trim()) {
    o.exactPhrase = topicSeed.trim();
  }
  o.anyWords = normalizeStrArray(p.any_words);
  if (typeof p.lang === "string" && p.lang.trim()) o.lang = p.lang.trim();
  if (typeof p.suggested_min_faves === "number" && p.suggested_min_faves > 0) {
    o.minFaves = p.suggested_min_faves;
  }
  if (typeof p.suggested_min_retweets === "number" && p.suggested_min_retweets > 0) {
    o.minRetweets = p.suggested_min_retweets;
  }
  if (typeof p.suggested_min_replies === "number" && p.suggested_min_replies > 0) {
    o.minReplies = p.suggested_min_replies;
  }
  o.repliesToggleOn = p.suggested_replies_toggle === true;
  o.repliesMode =
    p.suggested_replies_mode === "only_replies" ? "only_replies" : "include_all";
  o.linksToggleOn = p.suggested_links_toggle !== false;
  o.linksMode =
    p.suggested_links_mode === "only_with_links"
      ? "only_with_links"
      : "include_all";
  o.recommendedHashtags = normalizeStrArray(p.suggested_hashtags).map((h) =>
    h.startsWith("#") ? h : `#${h.replace(/^#+/, "")}`
  );
  return o;
}

const DEFAULT_FROM_TOPIC_SYSTEM =
  "You output only JSON for X Recent Search structured fields per prompts/scout-search-from-topic.prompt.txt.";

export async function scoutGenerateFromTopic(
  topic: string
): Promise<ScoutFromTopicResult> {
  const system =
    loadScoutSearchFromTopicPrompt()?.trim() || DEFAULT_FROM_TOPIC_SYSTEM;
  const user = `TOPIC (seed for search discovery):\n${topic.trim()}`;
  const { text } = await generateText(user, {
    model: SCOUT_MODEL,
    maxTokens: 1400,
    temperature: 0.35,
    systemPrompt: system,
  });
  const parsed = parseJsonFromLlm<LlmScoutFromTopicPayload>(text);
  if (!parsed) {
    throw new Error("Scout did not return valid JSON");
  }

  const name =
    typeof parsed.name === "string" ? parsed.name.trim() : "";

  if (
    typeof parsed.query_string === "string" &&
    parsed.query_string.trim() &&
    !parsed.all_words &&
    !parsed.any_words &&
    parsed.exact_phrase === undefined
  ) {
    const qs = parsed.query_string.trim();
    if (!name || !qs) {
      throw new Error("Scout did not return valid name + query_string");
    }
    if (qs.length > 512) {
      throw new Error("query_string exceeds 512 characters");
    }
    const opts = defaultQueryOptions();
    opts.exactPhrase = topic.trim();
    return { name, query_string: qs, query_options: opts };
  }

  if (!name) {
    throw new Error("Scout did not return a name");
  }

  const query_options = llmPayloadToOptions(parsed, topic);
  let query_string = buildQueryStringFromOptions(query_options);
  if (query_string.length > 512) {
    throw new Error(
      "Assembled query exceeds 512 characters — shorten words or disable some filters."
    );
  }
  return { name, query_string, query_options };
}

const DEFAULT_RECOMMEND_SYSTEM =
  "You output only JSON with suggestions array for X engagement topic ideas.";

export async function scoutSuggestTopics(): Promise<ScoutSuggestion[]> {
  const system =
    loadScoutTopicRecommendationsPrompt()?.trim() || DEFAULT_RECOMMEND_SYSTEM;
  const posts = await fetchRecentEntryTextsForScout();
  const rotation = loadScoutRotationTopics();
  const brand =
    process.env.X_ENGAGER_BRAND_NAME?.trim() ||
    process.env.SCOUT_ACCOUNT_HINT?.trim() ||
    "";
  const userParts = [
    "RECENT_POSTS_FROM_DB (newest first, snippets from our app):",
    posts.length
      ? posts.map((p, i) => `${i + 1}. ${p.replace(/\s+/g, " ")}`).join("\n")
      : "(none — user has little or no saved content yet)",
    "",
    "ROTATION_GUIDELINES (user file: prompts/scout-rotation-topics.md):",
    rotation || "(empty — user has not filled rotation topics yet)",
    "",
    "ACCOUNT_HINT (optional):",
    brand || "(not set)",
  ];
  const { text } = await generateText(userParts.join("\n"), {
    model: SCOUT_MODEL,
    maxTokens: 1200,
    temperature: 0.45,
    systemPrompt: system,
  });
  const parsed = parseJsonFromLlm<{
    suggestions?: Array<{ label?: string; rationale?: string }>;
  }>(text);
  const raw = parsed?.suggestions;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Scout did not return a valid suggestions array");
  }
  const suggestions: ScoutSuggestion[] = [];
  for (const s of raw) {
    const label = typeof s.label === "string" ? s.label.trim() : "";
    const rationale =
      typeof s.rationale === "string" ? s.rationale.trim() : "";
    if (label) suggestions.push({ label, rationale });
  }
  if (suggestions.length === 0) {
    throw new Error("No usable suggestions in model output");
  }
  return suggestions;
}

export { type QueryOptionsV1 } from "./x-query-assembler";
export {
  defaultQueryOptions,
  buildQueryStringFromOptions,
  assembleXRecentSearchQuery,
  optionsToAssembleInput,
  parseQueryOptions,
} from "./x-query-assembler";
