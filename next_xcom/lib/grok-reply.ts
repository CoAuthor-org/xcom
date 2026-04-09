import { loadEngagerProfileForPrompt } from "./engager-profile";
import { loadEnv } from "./env";
import { generateText } from "./llm";

loadEnv();

const DEFAULT_BRAND = "a thoughtful X participant";
const DEFAULT_TONE = "insightful, warm, and direct";

export function buildReplySystemPrompt(): string {
  const name =
    process.env.X_ENGAGER_BRAND_NAME?.trim() || DEFAULT_BRAND;
  const tone = process.env.X_ENGAGER_TONE?.trim() || DEFAULT_TONE;
  const profile = loadEngagerProfileForPrompt();
  const profileBlock =
    profile.length > 0
      ? `\n\n---\nWriter profile (use this to stay on-voice and accurate to this person; do not quote the file verbatim—embody it):\n${profile}\n---\n`
      : "";
  return `You are ${name}. Your tone is ${tone}.${profileBlock}
Rules:
- Always reference something specific from the original post.
- Add real value or ask a genuine question.
- Maximum 280 characters.
- Sound 100% human – never robotic, never salesy.
- Match the energy of the original post in substance (warmth, enthusiasm), not by copying punctuation or emoji. Do **not** use emojis in your reply, and never mirror or repeat emoji from the post you are replying to—that reads as robotic.
- Output **only** the final reply text: one message, as if posting it on X. Plain text only: no Markdown, no code fences (no \`\`\` or runs of backticks), no backtick-wrapped snippets unless you truly need one short \`like this\`—never end the reply with backticks or quotes that look like a closed fence.
- No meta-commentary, no stage directions, no parenthetical asides, no drafts, no alternatives, no self-corrections (e.g. do not write "Actually," or "(Wait, …)" or notes about rules).
- Never append counts or labels such as "(128 chars)", character counts, word counts, or "under N characters" — the reader should not see any length metadata.
- Your niche is tech / indie builders / SaaS / remote dev. If the post is clearly **off-topic** for that niche (e.g. hard news, geopolitics, war, elections, general politics) and not about products, code, careers, or creator/builder culture, do **not** debate the topic. Reply with **one short line** politely declining to engage on that subject (under 280 chars), or a neutral pivot to a related builder angle only if it fits naturally. Never take partisan positions.
- If the post is mainly a **sales or community funnel** (e.g. asking people to join Telegram, Discord, WhatsApp, a newsletter, a waitlist, or to leave X for another app), or it pushes constant off-platform action, do **not** play along or promote those channels. Reply with **one short line** that you are passing / not engaging with off-platform CTAs (under 280 chars). Do not ask follow-up questions that invite DMs or signups.`;
}

/**
 * Remove emoji so replies never mirror the other person's trailing 😀 etc. (models often copy anyway).
 * Strips pictographic emoji, modifiers, ZWJ glue, and VS16.
 */
function stripEmojisFromReply(text: string): string {
  let out = text;
  out = out.replace(/\p{Extended_Pictographic}/gu, "");
  out = out.replace(/\u200d/g, ""); // ZWJ
  out = out.replace(/\ufe0f/g, ""); // VS16
  out = out.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, ""); // skin tone
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

/** Models sometimes append phantom markdown fences, e.g. trailing \`\`\` or \`\`\`" */
function stripMarkdownFenceArtifacts(text: string): string {
  let out = text.trim();
  out = out.replace(/^`+/, "");
  // Trailing: optional space, run of backticks, optional ASCII/curly quotes
  const tailFence =
    /\s*`+[\s"'`´\u2018\u2019\u201c\u201d]*$/u;
  for (let i = 0; i < 15; i++) {
    const next = out.replace(tailFence, "").trimEnd();
    if (next === out) break;
    out = next;
  }
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

/** Strip parenthetical LLM "thinking" if the model ignores prompt constraints. */
export function sanitizeReplyDraft(text: string): string {
  const metaInner =
    /\b(wait|no emoji|no emojis|emojis|original|skip|neutral|note:|i'll|i will|stay neutral|thinking)\b/i;
  let out = text;
  for (let i = 0; i < 20; i++) {
    const next = out.replace(/\([^()]*\)/g, (full) => {
      const inner = full.slice(1, -1);
      if (/^\d+\s*(chars?|characters?)$/i.test(inner.trim())) return " ";
      return metaInner.test(inner) ? " " : full;
    });
    if (next === out) break;
    out = next;
  }
  for (let i = 0; i < 5; i++) {
    const next = out
      .replace(/\s*\(\d+\s*(chars?|characters?)\)\s*$/i, "")
      .trim();
    if (next === out) break;
    out = next;
  }
  out = out.replace(/\s+/g, " ").trim();
  out = stripMarkdownFenceArtifacts(out);
  out = stripEmojisFromReply(out);
  if (out.length > 280) {
    out = out.slice(0, 280).trim();
  }
  return out;
}

/**
 * Generate a reply draft for a single post. Used by discover + regenerate.
 */
export async function generateReplyForPost(originalPostText: string) {
  const model =
    process.env.X_ENGAGER_GROK_MODEL?.trim() || "grok-3-mini";
  const raw = await generateText(
    `Original post (reply to this):\n\n"""${originalPostText.replace(/"""/g, '"')}"""`,
    {
      model,
      maxTokens: 320,
      temperature: 0.75,
      systemPrompt: buildReplySystemPrompt(),
    }
  );
  return {
    ...raw,
    text: sanitizeReplyDraft(raw.text),
  };
}

export type InboundReplyContextPayload = {
  /** @username of the person who @mentioned you */
  mentionAuthor: string;
  /** Text of their tweet (the mention) */
  mentionText: string;
  /** Parent tweet they replied to, if any */
  parentTweetText?: string;
  /** Optional extra thread lines (oldest first) */
  threadSummary?: string;
};

/**
 * Grok draft for replying to someone who @mentioned you (reply thread or standalone mention).
 */
export async function generateReplyForInboundContext(ctx: InboundReplyContextPayload) {
  const model =
    process.env.X_ENGAGER_GROK_MODEL?.trim() || "grok-3-mini";
  const parts = [
    `Someone (@${ctx.mentionAuthor.replace(/^@/, "")}) mentioned you on X.`,
    "",
    `Their tweet:\n"""${ctx.mentionText.replace(/"""/g, '"')}"""`,
  ];
  if (ctx.parentTweetText?.trim()) {
    parts.push(
      "",
      `Tweet they were replying to (context):\n"""${ctx.parentTweetText.replace(/"""/g, '"')}"""`,
    );
  }
  if (ctx.threadSummary?.trim()) {
    parts.push("", `More thread context:\n${ctx.threadSummary.trim()}`);
  }
  parts.push(
    "",
    "Write ONE reply (as you) that responds naturally to them. Reference something specific they said."
  );
  const userPrompt = parts.join("\n");
  const raw = await generateText(userPrompt, {
    model,
    maxTokens: 320,
    temperature: 0.75,
    systemPrompt: buildReplySystemPrompt(),
  });
  return {
    ...raw,
    text: sanitizeReplyDraft(raw.text),
  };
}
