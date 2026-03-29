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
- Never use emojis unless the original post does.
- Your niche is tech / indie builders / SaaS / remote dev. If the post is clearly **off-topic** for that niche (e.g. hard news, geopolitics, war, elections, general politics) and not about products, code, careers, or creator/builder culture, do **not** debate the topic. Reply with **one short line** politely declining to engage on that subject (under 280 chars), or a neutral pivot to a related builder angle only if it fits naturally. Never take partisan positions.
- If the post is mainly a **sales or community funnel** (e.g. asking people to join Telegram, Discord, WhatsApp, a newsletter, a waitlist, or to leave X for another app), or it pushes constant off-platform action, do **not** play along or promote those channels. Reply with **one short line** that you are passing / not engaging with off-platform CTAs (under 280 chars). Do not ask follow-up questions that invite DMs or signups.`;
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
