import { NextResponse } from "next/server";
import { synthesizeEdgeTtsWithWords } from "@/lib/newsletters/synthesize-edge-tts";

/** Edge / neural TTS can exceed default Vercel limits. */
export const maxDuration = 120;
export const runtime = "nodejs";

const MAX_BODY_CHARS = 50_000;

type TtsApiWord = { text: string; start: number; end: number };

type TtsApiResponse = {
  mime: "audio/mpeg";
  audio: string;
  words: TtsApiWord[];
};

export async function POST(request: Request) {
  let body: { text?: string };
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > MAX_BODY_CHARS) {
    return NextResponse.json(
      { error: `Text too long (max ${MAX_BODY_CHARS} characters)` },
      { status: 400 }
    );
  }

  try {
    const { audio, words } = await synthesizeEdgeTtsWithWords(text);
    const payload: TtsApiResponse = {
      mime: "audio/mpeg",
      audio: audio.toString("base64"),
      words: words.map((w) => ({ text: w.text, start: w.start, end: w.end })),
    };
    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[newsletters/tts]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
