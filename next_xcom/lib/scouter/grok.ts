import { generateText, isInitialized } from "@/lib/llm";
import type { ScouterDraftPlatform } from "@/lib/scouter/types";

const DEFAULT_MODEL = process.env.SCOUTER_GROK_MODEL?.trim() || "grok-3-mini";

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

function parseJsonArray<T>(raw: string): T[] | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)?.[1]?.trim();
  const content = fenced || trimmed;
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    const start = content.indexOf("[");
    const end = content.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(content.slice(start, end + 1));
        return Array.isArray(parsed) ? (parsed as T[]) : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function isScouterLlmEnabled(): boolean {
  return isInitialized();
}

export async function summarizeKnowledge(
  contentRaw: string
): Promise<{ title: string; summary: string }> {
  const prompt = [
    "Return JSON only with keys title and summary.",
    "title: concise, max 90 chars.",
    "summary: practical summary in <= 6 bullet-worthy sentences, plain text.",
    "",
    "CONTENT:",
    contentRaw,
  ].join("\n");
  const { text } = await generateText(prompt, {
    model: DEFAULT_MODEL,
    maxTokens: 900,
    temperature: 0.2,
    systemPrompt:
      "You summarize technical content for agency operators. Output valid JSON only.",
  });
  const parsed = parseJsonObject<{ title?: string; summary?: string }>(text);
  const title = parsed?.title?.trim() || "Untitled knowledge item";
  const summary = parsed?.summary?.trim() || contentRaw.slice(0, 1200);
  return { title, summary };
}

export async function synthesizeDraftsFromKnowledge(
  summary: string
): Promise<Array<{ platform: ScouterDraftPlatform; draft_text: string }>> {
  const prompt = [
    "Return JSON array only.",
    "Each item: {\"platform\":\"twitter|linkedin|blog\",\"draft_text\":\"...\"}",
    "Generate one draft per platform.",
    "Twitter draft should be thread-ready and concise.",
    "LinkedIn should be professional and insight-first.",
    "Blog should be a compact intro paragraph + 3 bullet points.",
    "",
    "SUMMARY:",
    summary,
  ].join("\n");

  const { text } = await generateText(prompt, {
    model: DEFAULT_MODEL,
    maxTokens: 1400,
    temperature: 0.5,
    systemPrompt: "You create high quality multi-platform drafts. Output JSON array only.",
  });

  const parsed = parseJsonArray<{ platform?: string; draft_text?: string }>(text);
  const valid =
    parsed
      ?.map((row) => ({
        platform: row.platform as ScouterDraftPlatform,
        draft_text: row.draft_text?.trim() || "",
      }))
      .filter(
        (row) =>
          ["twitter", "linkedin", "blog"].includes(row.platform) && row.draft_text
      ) ?? [];

  if (valid.length > 0) return valid;

  return [
    { platform: "twitter", draft_text: summary.slice(0, 280) },
    { platform: "linkedin", draft_text: summary },
    { platform: "blog", draft_text: summary },
  ];
}

export async function scoreOpportunity(description: string): Promise<{
  match_score: number;
  outreach_draft: string;
}> {
  const prompt = [
    "Return JSON only with keys: match_score (1-10 integer), outreach_draft (string).",
    "Rate this company for remote USD agency contract potential based on stack and momentum.",
    "Write concise, personalized cold outreach email.",
    "",
    "COMPANY_DESCRIPTION:",
    description,
  ].join("\n");
  const { text } = await generateText(prompt, {
    model: DEFAULT_MODEL,
    maxTokens: 900,
    temperature: 0.35,
    systemPrompt: "You are a pragmatic agency growth strategist. Output JSON only.",
  });
  const parsed = parseJsonObject<{ match_score?: number; outreach_draft?: string }>(text);
  const score = Math.max(1, Math.min(10, Math.round(Number(parsed?.match_score ?? 5))));
  const outreach = parsed?.outreach_draft?.trim() || "No outreach draft generated.";
  return { match_score: score, outreach_draft: outreach };
}

export async function extractYoutubeSopJson(transcript: string): Promise<string> {
  const prompt = [
    "Turn this transcript into a compact SOP-style JSON document.",
    "Use keys: objective, prerequisites (array), steps (array), tools (array), pitfalls (array), summary.",
    "Output valid JSON only.",
    "",
    "TRANSCRIPT:",
    transcript,
  ].join("\n");
  const { text } = await generateText(prompt, {
    model: DEFAULT_MODEL,
    maxTokens: 1800,
    temperature: 0.3,
    systemPrompt: "You extract SOPs from transcripts. Output strict JSON only.",
  });
  return text.trim();
}
