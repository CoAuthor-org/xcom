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

export async function summarizeNewsletterEmail(input: {
  subject: string;
  fromAddress: string;
  rawText: string;
  linkPrimary: string | null;
}): Promise<{ tldr: string; summary_markdown: string }> {
  const linkHint = input.linkPrimary
    ? `Primary link to cite when relevant: ${input.linkPrimary}\n`
    : "";

  const prompt = [
    "Return JSON only with keys tldr and summary_markdown.",
    "tldr: one or two sentences, max 220 characters, plain text.",
    "summary_markdown: markdown with bullet lines (- item). Each important claim or topic should be a bullet.",
    "Embed relevant URLs as markdown links [anchor text](https://...) using the primary link above and any http(s) URLs that appear in the email body.",
    "Do not invent URLs. Keep bullets scannable (TLDR style).",
    "",
    linkHint,
    `From: ${input.fromAddress || "(unknown)"}`,
    `Subject: ${input.subject || "(no subject)"}`,
    "",
    "EMAIL BODY:",
    input.rawText.slice(0, 120_000),
  ].join("\n");

  const { text } = await generateText(prompt, {
    model: process.env.NEWSLETTERS_GROK_MODEL?.trim() || "grok-3-mini",
    maxTokens: 4096,
    temperature: 0.35,
    systemPrompt:
      "You are an assistant that summarizes newsletter emails into concise JSON. Output valid JSON only.",
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
