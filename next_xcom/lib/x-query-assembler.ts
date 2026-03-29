/**
 * Builds X API v2 Recent Search `query` strings (max 512 chars).
 * @see https://developer.x.com/en/docs/twitter-api/tweets/search/integrate/build-a-query
 */

export const QUERY_OPTIONS_VERSION = 1 as const;

export type ReplyFilter = "none" | "exclude_replies" | "only_replies";
export type LinkFilter = "any" | "has_links" | "no_links";

/** Serializable UI + assembler state (stored in search_queries.query_options). */
export interface QueryOptionsV1 {
  version: typeof QUERY_OPTIONS_VERSION;
  allWords: string[];
  exactPhrase: string;
  anyWords: string[];
  /** ISO 639-1; default en */
  lang: string;
  minFaves?: number | null;
  minRetweets?: number | null;
  minReplies?: number | null;
  /** When false: reply section collapsed; no is:reply filters from that UI. */
  repliesToggleOn: boolean;
  /** When repliesToggleOn: include_all = originals+replies in results; only_replies = is:reply */
  repliesMode: "include_all" | "only_replies";
  /** When false: link section collapsed; no has:links filters from that UI. */
  linksToggleOn: boolean;
  /** When linksToggleOn: include_all vs only posts with links */
  linksMode: "include_all" | "only_with_links";
  /** Shown as recommended; optional append via UI */
  recommendedHashtags: string[];
}

export function defaultQueryOptions(): QueryOptionsV1 {
  return {
    version: QUERY_OPTIONS_VERSION,
    allWords: [],
    exactPhrase: "",
    anyWords: [],
    lang: "en",
    minFaves: null,
    minRetweets: null,
    minReplies: null,
    repliesToggleOn: false,
    repliesMode: "include_all",
    linksToggleOn: true,
    linksMode: "include_all",
    recommendedHashtags: [],
  };
}

function normalizeWord(w: string): string {
  return w.replace(/\s+/g, " ").trim();
}

function escapePhraseForQuery(p: string): string {
  return p.replace(/"/g, '\\"');
}

export interface AssembleInput {
  allWords: string[];
  exactPhrase: string;
  anyWords: string[];
  lang: string;
  minFaves?: number | null;
  minRetweets?: number | null;
  minReplies?: number | null;
  replyFilter: ReplyFilter;
  linkFilter: LinkFilter;
  /** Appended by caller if needed */
  includeNoRetweet?: boolean;
}

export function replyFilterFromOptions(o: QueryOptionsV1): ReplyFilter {
  if (!o.repliesToggleOn) return "none";
  return o.repliesMode === "only_replies" ? "only_replies" : "none";
}

export function linkFilterFromOptions(o: QueryOptionsV1): LinkFilter {
  if (!o.linksToggleOn) return "any";
  return o.linksMode === "only_with_links" ? "has_links" : "any";
}

/**
 * Single source of truth: structured fields → one query string for client.v2.search
 */
export function assembleXRecentSearchQuery(input: AssembleInput): {
  query: string;
  withinLimit: boolean;
  length: number;
} {
  const chunks: string[] = [];

  const words = [
    ...new Set(
      input.allWords.map(normalizeWord).filter(Boolean)
    ),
  ];
  for (const w of words) {
    chunks.push(w);
  }

  const phrase = normalizeWord(input.exactPhrase);
  if (phrase) {
    chunks.push(`"${escapePhraseForQuery(phrase)}"`);
  }

  const anyClean = input.anyWords.map(normalizeWord).filter(Boolean);
  if (anyClean.length > 0) {
    chunks.push(`(${anyClean.join(" OR ")})`);
  }

  const lang = (input.lang || "en").trim().toLowerCase();
  if (lang) {
    chunks.push(`lang:${lang}`);
  }

  const mf = input.minFaves;
  const mr = input.minRetweets;
  const mre = input.minReplies;
  if (typeof mf === "number" && mf > 0) chunks.push(`min_faves:${Math.floor(mf)}`);
  if (typeof mr === "number" && mr > 0) chunks.push(`min_retweets:${Math.floor(mr)}`);
  if (typeof mre === "number" && mre > 0) chunks.push(`min_replies:${Math.floor(mre)}`);

  if (input.replyFilter === "exclude_replies") {
    chunks.push("-is:reply");
  } else if (input.replyFilter === "only_replies") {
    chunks.push("is:reply");
  }

  if (input.linkFilter === "has_links") {
    chunks.push("has:links");
  } else if (input.linkFilter === "no_links") {
    chunks.push("-has:links");
  }

  if (input.includeNoRetweet !== false) {
    chunks.push("-is:retweet");
  }

  let query = chunks.join(" ").replace(/\s+/g, " ").trim();
  const length = query.length;
  const withinLimit = length <= 512;
  return { query, withinLimit, length };
}

export function optionsToAssembleInput(o: QueryOptionsV1): AssembleInput {
  return {
    allWords: o.allWords,
    exactPhrase: o.exactPhrase,
    anyWords: o.anyWords,
    lang: o.lang || "en",
    minFaves: o.minFaves,
    minRetweets: o.minRetweets,
    minReplies: o.minReplies,
    replyFilter: replyFilterFromOptions(o),
    linkFilter: linkFilterFromOptions(o),
    includeNoRetweet: true,
  };
}

export function buildQueryStringFromOptions(o: QueryOptionsV1): string {
  return assembleXRecentSearchQuery(optionsToAssembleInput(o)).query;
}

/** Coerce unknown JSON from DB into QueryOptionsV1 or null. */
export function parseQueryOptions(
  raw: unknown
): QueryOptionsV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const x = raw as Record<string, unknown>;
  if (x.version !== QUERY_OPTIONS_VERSION) return null;
  const base = defaultQueryOptions();
  if (Array.isArray(x.allWords))
    base.allWords = x.allWords.filter((s) => typeof s === "string") as string[];
  if (typeof x.exactPhrase === "string") base.exactPhrase = x.exactPhrase;
  if (Array.isArray(x.anyWords))
    base.anyWords = x.anyWords.filter((s) => typeof s === "string") as string[];
  if (typeof x.lang === "string") base.lang = x.lang;
  if (typeof x.minFaves === "number") base.minFaves = x.minFaves;
  if (x.minFaves === null) base.minFaves = null;
  if (typeof x.minRetweets === "number") base.minRetweets = x.minRetweets;
  if (x.minRetweets === null) base.minRetweets = null;
  if (typeof x.minReplies === "number") base.minReplies = x.minReplies;
  if (x.minReplies === null) base.minReplies = null;
  if (typeof x.repliesToggleOn === "boolean") base.repliesToggleOn = x.repliesToggleOn;
  if (x.repliesMode === "include_all" || x.repliesMode === "only_replies")
    base.repliesMode = x.repliesMode;
  if (typeof x.linksToggleOn === "boolean") base.linksToggleOn = x.linksToggleOn;
  if (x.linksMode === "include_all" || x.linksMode === "only_with_links")
    base.linksMode = x.linksMode;
  if (Array.isArray(x.recommendedHashtags))
    base.recommendedHashtags = x.recommendedHashtags.filter(
      (s) => typeof s === "string"
    ) as string[];
  return base;
}
