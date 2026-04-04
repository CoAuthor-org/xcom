import fs from "fs";
import path from "path";
import { getProjectRoot } from "./env";

const FILE = "mentions.json";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeHandle(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return t.startsWith("@") ? t : `@${t}`;
}

type Cached = { mtimeMs: number; pairs: [string, string][] };

let cached: Cached | null = null;

/**
 * Load term → X handle map from prompts/mentions.json.
 * Keys matched as whole words (case-insensitive). Longer keys run first.
 */
export function loadMentionPairs(): [string, string][] {
  const root = getProjectRoot();
  const filePath = path.join(root, "prompts", FILE);
  try {
    if (!fs.existsSync(filePath)) {
      cached = { mtimeMs: -1, pairs: [] };
      return [];
    }
    const st = fs.statSync(filePath);
    if (cached && cached.mtimeMs === st.mtimeMs) {
      return cached.pairs;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data == null || typeof data !== "object" || Array.isArray(data)) {
      cached = { mtimeMs: st.mtimeMs, pairs: [] };
      return [];
    }
    const pairs: [string, string][] = [];
    for (const [k, v] of Object.entries(data)) {
      const term = String(k).trim();
      const handle = normalizeHandle(String(v ?? ""));
      if (!term || !handle) continue;
      pairs.push([term, handle]);
    }
    pairs.sort((a, b) => b[0].length - a[0].length);
    cached = { mtimeMs: st.mtimeMs, pairs };
    return pairs;
  } catch (e) {
    console.warn(
      "[prompt-mentions] could not load mentions.json:",
      e instanceof Error ? e.message : e
    );
    return [];
  }
}

/**
 * Replace configured terms with X handles using regex only (no LLM).
 * Skips matches inside http(s) URLs, and when the word is right after # or @.
 */
export function applyPromptMentions(text: string): string {
  if (!text || typeof text !== "string") return text;
  const pairs = loadMentionPairs();
  if (pairs.length === 0) return text;

  const segments = text.split(/(https?:\/\/\S+)/gi);
  return segments
    .map((segment, index) => {
      if (index % 2 === 1 && /^https?:\/\//i.test(segment)) {
        return segment;
      }
      let s = segment;
      for (const [term, handle] of pairs) {
        const escaped = escapeRegex(term);
        const re = new RegExp(`(?<![#@])\\b${escaped}\\b`, "gi");
        s = s.replace(re, handle);
      }
      return s;
    })
    .join("");
}
