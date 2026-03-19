import OpenAI from "openai";
import { loadEnv } from "./env";

loadEnv();

const XAI_BASE_URL = "https://api.x.ai/v1";

let client: OpenAI | null = null;

const XAI_API_KEY = process.env.XAI_API_KEY || "";

if (XAI_API_KEY) {
  try {
    client = new OpenAI({
      apiKey: XAI_API_KEY,
      baseURL: XAI_BASE_URL,
    });
    console.log("Grok (xAI) client initialized successfully");
  } catch (err) {
    console.error("Failed to initialize xAI client:", (err as Error).message);
  }
} else {
  console.warn("xAI API key not provided. LLM features will be disabled.");
}

export function isInitialized(): boolean {
  return client !== null;
}

const DEFAULT_MODEL = "grok-3-mini";

export async function generateText(
  prompt: string,
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  } = {}
) {
  if (!client) {
    throw new Error(
      "Grok client not initialized. Please set XAI_API_KEY environment variable."
    );
  }

  const {
    model = DEFAULT_MODEL,
    maxTokens = 280,
    temperature = 0.7,
    systemPrompt = "You are a helpful assistant that generates concise, engaging text. Keep responses under 280 characters.",
  } = options;

  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  });

  const generatedText = completion.choices[0]?.message?.content || "";

  return {
    success: true,
    text: generatedText.trim(),
    usage: {
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
    },
  };
}

export async function enhanceText(
  text: string,
  instruction = "Improve this text while keeping the same meaning"
) {
  return generateText(`${instruction}:\n\n"${text}"`, {
    systemPrompt:
      "You are a text editor. Improve the given text based on the instruction. Output only the improved text, nothing else. Keep it under 280 characters.",
  });
}

export async function summarizeText(text: string) {
  return generateText(`Summarize this text in under 280 characters:\n\n"${text}"`, {
    systemPrompt:
      "You are a summarizer. Create a concise summary under 280 characters. Output only the summary.",
  });
}

export async function expandText(text: string) {
  return generateText(
    `Expand on this idea while keeping under 280 characters:\n\n"${text}"`,
    {
      systemPrompt:
        "You are a creative writer. Expand on the given idea but keep the result under 280 characters. Output only the expanded text.",
    }
  );
}

// RAG: notes → tweets
const RAG_MODEL = "grok-3-mini";
const RAG_MAX_OUTPUT_TOKENS = 3000;
const RAG_SINGLE_POST_MAX_TOKENS = 400;
const RAG_TEMPERATURE = 0.4;

const DEFAULT_NOTES_TO_TWEETS_PROMPT =
  "Convert the notes below into x.com-style posts. Each post ≤280 chars. Output only the posts, one per line. No numbering or labels.";
const ONE_POST_INSTRUCTION =
  "\n\nOutput exactly ONE post only. No second post, no \"Post 2\", no numbering. Your post MUST be 280 characters or fewer. Complete the full sentence within that limit—never output a cut-off or incomplete sentence. Nothing else.";

const POLL_INSTRUCTION =
  "\n\nOutput exactly ONE X (Twitter) poll. Use this format only—no other text:\nQuestion: <poll question, max 280 characters>\nOptions:\n- <Option 1, max 25 characters>\n- <Option 2, max 25 characters>\n- <Option 3, max 25 characters, optional>\n- <Option 4, max 25 characters, optional>\nYou MUST provide at least 2 options and at most 4. Each option label MUST be 25 characters or fewer. The question must be engaging and drawn from the notes. No explanations, no hashtags in options.";

function stripAttachPlaceholders(s: string): string {
  if (!s || typeof s !== "string") return s;
  return s
    .replace(/\s*\[\s*Attach\s*:\s*[^\]]*\]\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimToLimit(s: string, limit = 280): string {
  if (!s || s.length <= limit) return s;
  const inRange = s.slice(0, limit + 1);
  const minSentenceLen = 80;
  const lastSentenceEnd = Math.max(
    inRange.lastIndexOf("."),
    inRange.lastIndexOf("?"),
    inRange.lastIndexOf("!")
  );
  if (lastSentenceEnd >= minSentenceLen)
    return s.slice(0, lastSentenceEnd + 1).trim();
  const lastSpace = inRange.lastIndexOf(" ");
  if (lastSpace >= 0) return s.slice(0, lastSpace).trim();
  return s.slice(0, limit).trim();
}

export { stripAttachPlaceholders };
export { trimToLimit as trimToTweetLength };

interface ParsedTweet {
  text: string;
  topicRef?: string | null;
  part?: number | null;
}

function parseNotesToTweetsOutput(raw: string): ParsedTweet[] {
  const tweets: ParsedTweet[] = [];
  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const line of lines) {
    const post1Match = line.match(/^Post\s*1\s*(\[[^\]]+\])?\s*:\s*(.*)/i);
    const post2Match = line.match(/^Post\s*2\s*(\[[^\]]+\])?\s*:\s*(.*)/i);
    const topicFrom = (m: RegExpMatchArray | null) =>
      m && m[1] ? m[1].replace(/^\[|\]$/g, "").trim() : null;
    let text: string;
    let topicRef: string | null = null;
    let part: number | null = null;
    if (post1Match) {
      text = trimToLimit(stripAttachPlaceholders(post1Match[2].trim()));
      topicRef = topicFrom(post1Match);
      part = 1;
    } else if (post2Match) {
      text = trimToLimit(stripAttachPlaceholders(post2Match[2].trim()));
      topicRef = topicFrom(post2Match);
      part = 2;
    } else {
      text = trimToLimit(stripAttachPlaceholders(line));
    }
    if (text.length > 0) {
      const looksLikeHeading =
        text.length < 80 &&
        !text.includes("?") &&
        !text.includes("#") &&
        !text.includes(".");
      if (looksLikeHeading) continue;
      tweets.push(
        topicRef != null || part != null ? { text, topicRef, part } : { text }
      );
    }
  }
  return tweets;
}

export interface ParsedPoll {
  text: string;
  options: string[];
}

const POLL_OPTION_MAX_LEN = 25;

function parseNotesToPollOutput(raw: string): ParsedPoll | null {
  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  let question = "";
  const options: string[] = [];
  let inDashOptions = false;
  for (const line of lines) {
    const qMatch = line.match(/^Question\s*:\s*(.*)/i);
    const optLineMatch = line.match(/^Option\s*(\d+)\s*:\s*(.*)/i);
    const optionsHeaderMatch = line.match(/^Options\s*:?\s*$/i);
    const dashOptMatch = line.match(/^-\s*(.*)/);
    if (qMatch) {
      question = trimToLimit(stripAttachPlaceholders(qMatch[1].trim()), 280);
      inDashOptions = false;
    } else if (optionsHeaderMatch) {
      inDashOptions = true;
    } else if (dashOptMatch && inDashOptions) {
      const label = stripAttachPlaceholders(dashOptMatch[1].trim()).slice(
        0,
        POLL_OPTION_MAX_LEN
      );
      if (label.length > 0) options.push(label);
    } else if (optLineMatch) {
      const label = stripAttachPlaceholders(optLineMatch[2].trim()).slice(
        0,
        POLL_OPTION_MAX_LEN
      );
      if (label.length > 0) options.push(label);
    }
  }
  if (!question || options.length < 2 || options.length > 4) return null;
  return { text: question, options };
}

export async function notesToPoll(
  chunkText: string,
  options: { systemPrompt?: string } = {}
) {
  if (!client) {
    throw new Error("Grok client not initialized. Set XAI_API_KEY.");
  }
  let systemPrompt =
    (options.systemPrompt && options.systemPrompt.trim()) ||
    DEFAULT_NOTES_TO_TWEETS_PROMPT + POLL_INSTRUCTION;
  // If a dedicated polls prompt file is provided (already contains format rules),
  // don't append POLL_INSTRUCTION again.
  if (options.systemPrompt && options.systemPrompt.includes("Guardrails (system instructions) — POLLS")) {
    systemPrompt = options.systemPrompt.trim();
  }
  const completion = await client.chat.completions.create({
    model: RAG_MODEL,
    max_tokens: RAG_SINGLE_POST_MAX_TOKENS,
    temperature: RAG_TEMPERATURE,
    messages: [
      { role: "system", content: systemPrompt + POLL_INSTRUCTION },
      { role: "user", content: chunkText },
    ],
  });
  const raw = completion.choices[0]?.message?.content || "";
  const poll = parseNotesToPollOutput(raw);
  return {
    success: true,
    poll: poll ?? undefined,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : null,
  };
}

/** Parse thread output in "1/ ... 2/ ... 3/ ..." format. Strips numbering and returns posts in order. */
function parseNotesToThreadsOutput(raw: string): string[] {
  const posts: string[] = [];
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^\d+\/\s*(.+)$/);
    if (match) {
      let text = stripAttachPlaceholders(match[1].trim());
      text = trimToLimit(text, 280);
      if (text.length > 0) posts.push(text);
    }
  }
  return posts;
}

export interface NotesToThreadsResult {
  success: boolean;
  posts: string[];
  usage: { promptTokens: number; completionTokens: number } | null;
}

export async function notesToThreads(
  chunkText: string,
  options: { systemPrompt?: string } = {}
) {
  if (!client) {
    throw new Error("Grok client not initialized. Set XAI_API_KEY.");
  }
  const systemPrompt =
    (options.systemPrompt && options.systemPrompt.trim()) ||
    DEFAULT_NOTES_TO_TWEETS_PROMPT;
  const completion = await client.chat.completions.create({
    model: RAG_MODEL,
    max_tokens: RAG_MAX_OUTPUT_TOKENS,
    temperature: RAG_TEMPERATURE,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: chunkText },
    ],
  });
  const raw = completion.choices[0]?.message?.content || "";
  const posts = parseNotesToThreadsOutput(raw);
  return {
    success: true,
    posts,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens || 0,
          completionTokens: completion.usage.completion_tokens || 0,
        }
      : null,
  };
}

export async function notesToTweets(
  chunkText: string,
  options: {
    systemPrompt?: string;
    onePostOnly?: boolean;
  } = {}
) {
  if (!client) {
    throw new Error("Grok client not initialized. Set XAI_API_KEY.");
  }
  let systemPrompt =
    (options.systemPrompt && options.systemPrompt.trim()) ||
    DEFAULT_NOTES_TO_TWEETS_PROMPT;
  const onePostOnly = options.onePostOnly === true;
  if (onePostOnly) {
    systemPrompt = systemPrompt + ONE_POST_INSTRUCTION;
  }
  const completion = await client.chat.completions.create({
    model: RAG_MODEL,
    max_tokens: onePostOnly ? RAG_SINGLE_POST_MAX_TOKENS : RAG_MAX_OUTPUT_TOKENS,
    temperature: RAG_TEMPERATURE,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: chunkText },
    ],
  });
  const raw = completion.choices[0]?.message?.content || "";
  let tweets = parseNotesToTweetsOutput(raw);
  if (onePostOnly && tweets.length > 1) {
    tweets = [tweets[0]];
  }
  return {
    success: true,
    tweets,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : null,
  };
}
