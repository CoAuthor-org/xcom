import { loadEnv } from "@/lib/env";

loadEnv();

const XAI_EMBEDDING_MODEL =
  process.env.SCOUTER_EMBEDDING_MODEL?.trim() ||
  process.env.XAI_EMBEDDING_MODEL?.trim() ||
  "text-embedding-3-small";

const XAI_API_KEY =
  process.env.XAI_API_KEY?.trim() || process.env.GROK_API_KEY?.trim() || "";

const XAI_BASE_URL = "https://api.x.ai/v1";

export function embeddingsEnabled(): boolean {
  return Boolean(XAI_API_KEY);
}

export async function createEmbedding(text: string): Promise<number[] | null> {
  const input = text.trim();
  if (!input || !XAI_API_KEY) return null;

  const res = await fetch(`${XAI_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: XAI_EMBEDDING_MODEL,
      input,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Embedding request failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const vector = data.data?.[0]?.embedding;
  return Array.isArray(vector) ? vector : null;
}
