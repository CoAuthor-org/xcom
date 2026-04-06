import fs from "fs";
import path from "path";
import { getProjectRoot } from "./env";

const REL_PATH = path.join("templates", "my-profile.md");
const MAX_CHARS = 3500;

type Cached = { mtimeMs: number; block: string };

let cached: Cached | null = null;

/** Remove HTML comments so a file can ship with instructions only (optional profile). */
function stripHtmlComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * Load templates/my-profile.md for X Engager reply prompts (outbound + inbound).
 * Returns a trimmed block for the system prompt, or empty string if the file is
 * missing, whitespace-only, or has no text outside HTML comments (optional until you add real content).
 */
export function loadEngagerProfileForPrompt(): string {
  const root = getProjectRoot();
  const filePath = path.join(root, REL_PATH);
  try {
    if (!fs.existsSync(filePath)) {
      cached = { mtimeMs: -1, block: "" };
      return "";
    }
    const st = fs.statSync(filePath);
    if (cached && cached.mtimeMs === st.mtimeMs) {
      return cached.block;
    }
    const raw = fs.readFileSync(filePath, "utf8").trim();
    const withoutComments = stripHtmlComments(raw).trim();
    if (!withoutComments) {
      cached = { mtimeMs: st.mtimeMs, block: "" };
      return "";
    }
    const block =
      withoutComments.length > MAX_CHARS
        ? `${withoutComments.slice(0, MAX_CHARS).trim()}…`
        : withoutComments;
    cached = { mtimeMs: st.mtimeMs, block };
    return block;
  } catch (e) {
    console.warn(
      "[engager-profile] could not read templates/my-profile.md:",
      e instanceof Error ? e.message : e
    );
    return "";
  }
}
