const DEFAULT_VOICE = "en-US-AvaMultilingualNeural";
/** Rough cap per synthesis request (library also splits at ~4096 bytes). */
const MAX_CHARS = 48_000;

/** One word/token from Edge TTS metadata; times are seconds on the synthesized audio timeline. */
export type TtsWordTiming = {
  text: string;
  start: number;
  end: number;
};

export type EdgeTtsSynthesisResult = {
  audio: Buffer;
  words: TtsWordTiming[];
};

/**
 * Converts Edge offset/duration (100-nanosecond units) to seconds (matches edge-tts-universal SubMaker).
 */
function toSeconds(offset: number, duration: number): { start: number; end: number } {
  return {
    start: offset / 1e7,
    end: (offset + duration) / 1e7,
  };
}

/**
 * Synthesizes speech via Microsoft Edge’s neural TTS and collects word-level timings for karaoke UI.
 */
export async function synthesizeEdgeTtsWithWords(text: string): Promise<EdgeTtsSynthesisResult> {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    throw new Error("Empty text for TTS");
  }

  const payload = trimmed.length > MAX_CHARS ? `${trimmed.slice(0, MAX_CHARS)}…` : trimmed;
  const voice = process.env.NEWSLETTERS_EDGE_TTS_VOICE?.trim() || DEFAULT_VOICE;
  const rate = process.env.NEWSLETTERS_EDGE_TTS_RATE?.trim();
  const pitch = process.env.NEWSLETTERS_EDGE_TTS_PITCH?.trim();

  const { Communicate } = await import("edge-tts-universal");
  const communicate = new Communicate(payload, {
    voice,
    ...(rate ? { rate } : {}),
    ...(pitch ? { pitch } : {}),
  });

  const chunks: Buffer[] = [];
  const words: TtsWordTiming[] = [];

  for await (const chunk of communicate.stream()) {
    if (chunk.type === "audio" && chunk.data) {
      chunks.push(chunk.data);
    } else if (chunk.type === "WordBoundary" && chunk.offset != null && chunk.duration != null) {
      const { start, end } = toSeconds(chunk.offset, chunk.duration);
      const w = typeof chunk.text === "string" ? chunk.text : "";
      words.push({ text: w, start, end });
    }
  }

  const audio = Buffer.concat(chunks);
  if (audio.length === 0) {
    throw new Error("Edge TTS returned no audio");
  }

  return { audio, words };
}

/** @deprecated Use synthesizeEdgeTtsWithWords; kept for callers that only need MP3. */
export async function synthesizeEdgeTtsToMp3Buffer(text: string): Promise<Buffer> {
  const { audio } = await synthesizeEdgeTtsWithWords(text);
  return audio;
}
