import { generateText, isInitialized } from "@/lib/llm";

function parseJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)?.[1]?.trim();
  const content = fenced || trimmed;
  try {
    return JSON.parse(content) as T;
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function isNewsletterLlmEnabled(): boolean {
  return isInitialized();
}

export type BatchEmailInput = {
  id: string;
  subject: string;
  from_address: string;
  raw_text: string;
  link_primary: string | null;
};

const MAX_BODY_PER_EMAIL = 4_000;
const MAX_EMAILS = 40;

export async function summarizeNewsletterBatch(
  emails: BatchEmailInput[],
  periodStartIso: string,
  periodEndIso: string
): Promise<{ tldr: string; summary_markdown: string }> {
  if (emails.length === 0) {
    throw new Error("No emails to summarize");
  }

  const slice = emails.slice(0, MAX_EMAILS);
  const blocks = slice.map((e, i) => {
    const body = e.raw_text.replace(/\s+/g, " ").trim().slice(0, MAX_BODY_PER_EMAIL);
    const link = e.link_primary ? `Link: ${e.link_primary}\n` : "";
    return [
      `### Email ${i + 1} (id:${e.id})`,
      `Subject: ${e.subject || "(no subject)"}`,
      `From: ${e.from_address || "(unknown)"}`,
      link,
      body,
      "",
    ].join("\n");
  });

  const prompt = [
    `You are summarizing multiple newsletter emails received between ${periodStartIso} and ${periodEndIso} (inclusive window).`,
    "Return JSON only with keys tldr and summary_markdown.",
    "tldr: one short paragraph, max 400 characters, plain text — the overall gist of ALL emails together.",
    "summary_markdown: markdown with sections or bullet groups by theme. Mention which newsletter each point came from when useful (by subject line).",
    "Embed real URLs as [text](https://...) only from the email bodies or Link lines below. Do not invent URLs.",
    "Be dense and scannable; skip fluff.",
    "",
    "EMAILS:",
    ...blocks,
  ].join("\n");

  const { text } = await generateText(prompt, {
    model: process.env.NEWSLETTERS_GROK_MODEL?.trim() || "grok-3-mini",
    maxTokens: 8192,
    temperature: 0.35,
    systemPrompt:
      "You produce a single digest JSON object summarizing many newsletters at once. Output valid JSON only.",
  });

  const parsed = parseJsonObject<{ tldr?: string; summary_markdown?: string }>(text);
  const tldr = typeof parsed?.tldr === "string" ? parsed.tldr.trim() : "";
  const summary_markdown =
    typeof parsed?.summary_markdown === "string" ? parsed.summary_markdown.trim() : "";

  if (!tldr || !summary_markdown) {
    throw new Error("LLM returned invalid JSON (missing tldr or summary_markdown)");
  }

  return { tldr, summary_markdown };
}
