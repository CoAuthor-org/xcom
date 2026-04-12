"use client";

import * as React from "react";
import {
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { TimedWord } from "./digest-tts-utils";
import {
  activeWordIndex,
  buildSentenceRanges,
  jumpSentences,
} from "./digest-tts-utils";

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  /** Exact text sent to TTS (used as cache key with digestId). */
  plainText: string;
  digestId: string;
  onError?: (message: string) => void;
};

export function DigestTtsPlayer({ plainText, digestId, onError }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [words, setWords] = React.useState<TimedWord[]>([]);
  const [duration, setDuration] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = React.useRef<string | null>(null);
  const loadedKeyRef = React.useRef<string>("");
  const activeRef = React.useRef<HTMLSpanElement | null>(null);

  const sentenceRanges = React.useMemo(() => buildSentenceRanges(words), [words]);
  const wordIdx = React.useMemo(
    () => activeWordIndex(words, currentTime),
    [words, currentTime]
  );

  const stopCleanup = React.useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    audioRef.current = null;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setWords([]);
    setDuration(0);
    setCurrentTime(0);
    setPlaying(false);
    setReady(false);
    loadedKeyRef.current = "";
  }, []);

  React.useEffect(() => {
    stopCleanup();
  }, [digestId, stopCleanup]);

  React.useEffect(() => {
    const el = activeRef.current;
    if (el && playing) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [wordIdx, playing]);

  const attachAudio = React.useCallback((audio: HTMLAudioElement) => {
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const ensureLoaded = React.useCallback(async () => {
    const key = `${digestId}:${plainText.length}:${plainText.slice(0, 120)}`;
    if (loadedKeyRef.current === key && audioRef.current) {
      return audioRef.current;
    }
    stopCleanup();

    const trimmed = plainText.replace(/\s+/g, " ").trim();
    if (!trimmed) {
      onError?.("Nothing to read");
      return null;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/newsletters/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      if (!res.ok) {
        let detail = res.statusText;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) detail = j.error;
        } catch {
          detail = await res.text().catch(() => detail);
        }
        throw new Error(detail || `TTS failed (${res.status})`);
      }

      const data = (await res.json()) as {
        mime?: string;
        audio?: string;
        words?: TimedWord[];
        error?: string;
      };

      if (data.error || !data.audio) {
        throw new Error(data.error || "Invalid TTS response");
      }

      const blob = base64ToBlob(data.audio, data.mime || "audio/mpeg");
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      attachAudio(audio);
      setWords(Array.isArray(data.words) ? data.words : []);

      loadedKeyRef.current = key;
      setReady(true);
      return audio;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onError?.(msg);
      stopCleanup();
      return null;
    } finally {
      setLoading(false);
    }
  }, [plainText, digestId, onError, stopCleanup, attachAudio]);

  const togglePlay = async () => {
    const audio = audioRef.current ?? (await ensureLoaded());
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      onError?.(
        "Playback blocked — tap Play again (mobile often requires a direct tap)."
      );
    }
  };

  const stop = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setCurrentTime(0);
    setPlaying(false);
  };

  const seek = React.useCallback((t: number) => {
    const a = audioRef.current;
    if (!a) return;
    const d = a.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    const next = Math.max(0, Math.min(d, t));
    a.currentTime = next;
    setCurrentTime(next);
  }, []);

  const skipSeconds = (delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    seek(a.currentTime + delta);
  };

  const skipSentencesBy = (delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    if (sentenceRanges.length === 0) {
      seek(a.currentTime + delta * 5);
      return;
    }
    const t = jumpSentences(sentenceRanges, a.currentTime, delta);
    seek(t);
  };

  React.useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute("src");
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const sliderMax = duration > 0 ? duration : 1;

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-[#c8c8c8] bg-[#f2f2f2] p-3 sm:p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[#555]">
        Listen with transcript
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void togglePlay()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[#bebebe] bg-[#2d2d2d] px-3 py-2 text-sm font-medium text-white touch-manipulation disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : playing && ready ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {loading ? "Preparing…" : playing && ready ? "Pause" : "Play"}
        </button>

        <button
          type="button"
          onClick={stop}
          disabled={!ready}
          className="inline-flex items-center gap-1 rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-2 py-2 text-xs font-medium text-[#2d2d2d] touch-manipulation disabled:opacity-40"
          title="Stop"
        >
          <Square className="h-3.5 w-3.5" />
          Stop
        </button>

        <button
          type="button"
          onClick={() => skipSeconds(-10)}
          disabled={!ready}
          className="inline-flex items-center gap-1 rounded-lg border border-[#bebebe] bg-[#e8e8e8] px-2 py-1.5 text-xs font-medium text-[#2d2d2d] touch-manipulation disabled:opacity-40"
        >
          <SkipBack className="h-3.5 w-3.5" />
          −10s
        </button>
        <button
          type="button"
          onClick={() => skipSeconds(10)}
          disabled={!ready}
          className="inline-flex items-center gap-1 rounded-lg border border-[#bebebe] bg-[#e8e8e8] px-2 py-1.5 text-xs font-medium text-[#2d2d2d] touch-manipulation disabled:opacity-40"
        >
          +10s
          <SkipForward className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => skipSentencesBy(-1)}
          disabled={!ready || sentenceRanges.length === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-[#bebebe] bg-[#e8e8e8] px-2 py-1.5 text-xs font-medium text-[#2d2d2d] touch-manipulation disabled:opacity-40"
          title="Previous sentence"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Sent
        </button>
        <button
          type="button"
          onClick={() => skipSentencesBy(1)}
          disabled={!ready || sentenceRanges.length === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-[#bebebe] bg-[#e8e8e8] px-2 py-1.5 text-xs font-medium text-[#2d2d2d] touch-manipulation disabled:opacity-40"
          title="Next sentence"
        >
          Sent
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => skipSentencesBy(-2)}
          disabled={!ready || sentenceRanges.length < 2}
          className="rounded-lg border border-[#bebebe] bg-[#dedede] px-2 py-1.5 text-xs font-medium text-[#2d2d2d] touch-manipulation disabled:opacity-40"
        >
          −2 sent
        </button>
        <button
          type="button"
          onClick={() => skipSentencesBy(2)}
          disabled={!ready || sentenceRanges.length < 2}
          className="rounded-lg border border-[#bebebe] bg-[#dedede] px-2 py-1.5 text-xs font-medium text-[#2d2d2d] touch-manipulation disabled:opacity-40"
        >
          +2 sent
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs text-[#444]">
        <span className="tabular-nums">{formatClock(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={sliderMax}
          step={0.05}
          value={Math.min(currentTime, sliderMax)}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!ready || duration <= 0}
          className="h-2 flex-1 cursor-pointer accent-[#2d2d2d] disabled:opacity-40"
          aria-label="Seek audio"
        />
        <span className="tabular-nums">{formatClock(duration)}</span>
      </div>

      {words.length > 0 ? (
        <div className="max-h-52 overflow-y-auto rounded-lg border border-[#d4d4d4] bg-white p-3 text-sm leading-relaxed text-[#1a1a1a] sm:max-h-64">
          {words.map((w, i) => (
            <span
              key={`${i}-${w.start}`}
              ref={i === wordIdx ? activeRef : undefined}
              className={
                i === wordIdx
                  ? "rounded bg-amber-200 px-0.5 text-[#1a1a1a] transition-colors"
                  : undefined
              }
            >
              {w.text}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#666]">
          Word highlights appear after the first successful Play (Edge TTS word boundaries).
        </p>
      )}
    </div>
  );
}
