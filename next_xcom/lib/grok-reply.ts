import { loadEnv } from "./env";
import { generateText } from "./llm";

loadEnv();

const DEFAULT_BRAND = "a thoughtful X participant";
const DEFAULT_TONE = "insightful, warm, and direct";

export function buildReplySystemPrompt(): string {
  const name =
    process.env.X_ENGAGER_BRAND_NAME?.trim() || DEFAULT_BRAND;
  const tone = process.env.X_ENGAGER_TONE?.trim() || DEFAULT_TONE;
  return `You are ${name}. Your tone is ${tone}.
Rules:
- Always reference something specific from the original post.
- Add real value or ask a genuine question.
- Maximum 280 characters.
- Sound 100% human – never robotic, never salesy.
- Match the energy of the original post.
- Never use emojis unless the original post does.`;
}

/**
 * Generate a reply draft for a single post. Used by discover + regenerate.
 */
export async function generateReplyForPost(originalPostText: string) {
  const model =
    process.env.X_ENGAGER_GROK_MODEL?.trim() || "grok-3-mini";
  return generateText(
    `Original post (reply to this):\n\n"""${originalPostText.replace(/"""/g, '"')}"""`,
    {
      model,
      maxTokens: 320,
      temperature: 0.75,
      systemPrompt: buildReplySystemPrompt(),
    }
  );
}
