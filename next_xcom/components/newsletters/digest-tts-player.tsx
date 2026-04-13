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
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { TimedWord } from "./digest-tts-utils";
import {
  activeWordIndex,
  buildSentenceRanges,
  jumpSentences,
} from "./digest-tts-utils";
import { stripMarkdownForTts } from "./simple-markdown";

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
  tldr: string;
  summaryMarkdown: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onError?: (message: string) => void;
};

type FullDigestBlock = {
  kind: "heading" | "bullet" | "paragraph" | "spacer";
  displayText: string;
  speechText: string;
};

type LinkSegment = {
  text: string;
  href: string | null;
};

function normalizeDigestDisplayText(input: string): string {
  return input
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLinkSegments(input: string): LinkSegment[] {
  const segments: LinkSegment[] = [];
  const re = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    if (m.index > last) {
      segments.push({ text: input.slice(last, m.index), href: null });
    }
    segments.push({ text: m[1], href: m[2] });
    last = m.index + m[0].length;
  }
  if (last < input.length) {
    segments.push({ text: input.slice(last), href: null });
  }
  return segments.length > 0 ? segments : [{ text: input, href: null }];
}

function buildFullDigestBlocks(raw: string): FullDigestBlock[] {
  const lines = raw.split(/\r?\n/);
  const blocks: FullDigestBlock[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      blocks.push({ kind: "spacer", displayText: "", speechText: "" });
      continue;
    }
    if (/^#{1,6}\s+/.test(trimmed)) {
      const plain = trimmed.replace(/^#{1,6}\s+/, "").trim();
      blocks.push({
        kind: "heading",
        displayText: normalizeDigestDisplayText(plain),
        speechText: stripMarkdownForTts(plain),
      });
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      const plain = trimmed.replace(/^[-*]\s+/, "").trim();
      blocks.push({
        kind: "bullet",
        displayText: normalizeDigestDisplayText(plain),
        speechText: stripMarkdownForTts(plain),
      });
      continue;
    }
    blocks.push({
      kind: "paragraph",
      displayText: normalizeDigestDisplayText(trimmed),
      speechText: stripMarkdownForTts(trimmed),
    });
  }
  return blocks;
}

export function DigestTtsPlayer({
  plainText,
  digestId,
  tldr,
  summaryMarkdown,
  expanded,
  onToggleExpanded,
  onError,
}: Props) {
  const [loading, setLoading] = React.useState(false);
  const [words, setWords] = React.useState<TimedWord[]>([]);
  const [duration, setDuration] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = React.useRef<string | null>(null);
  const loadedKeyRef = React.useRef<string>("");

  const sentenceRanges = React.useMemo(() => buildSentenceRanges(words), [words]);
  const wordIdx = React.useMemo(
    () => activeWordIndex(words, currentTime),
    [words, currentTime]
  );
  const tldrTokenCount = React.useMemo(() => {
    const normalized = tldr.replace(/\s+/g, " ").trim();
    if (!normalized) return 0;
    return normalized.split(" ").filter(Boolean).length;
  }, [tldr]);
  const boundaryIdx = React.useMemo(
    () => Math.max(0, Math.min(tldrTokenCount, words.length)),
    [tldrTokenCount, words.length]
  );
  const fullDigestBlocks = React.useMemo(
    () => buildFullDigestBlocks(summaryMarkdown),
    [summaryMarkdown]
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

  const renderWordSlice = React.useCallback(
    (start: number, end: number, fallbackText: string) => {
      if (words.length === 0 || end <= start) {
        return <p className="mt-1 whitespace-pre-wrap break-words">{fallbackText}</p>;
      }
      return (
        <p className="mt-1 whitespace-pre-wrap break-words">
          {words.slice(start, end).map((w, i) => {
            const absoluteIdx = start + i;
            return (
              <React.Fragment key={`${absoluteIdx}-${w.start}`}>
                <span
                  className={
                    absoluteIdx === wordIdx
                      ? "rounded bg-amber-200 px-0.5 text-[#1a1a1a] transition-colors"
                      : undefined
                  }
                >
                  {w.text}
                </span>{" "}
              </React.Fragment>
            );
          })}
        </p>
      );
    },
    [words, wordIdx]
  );

  const renderLinkedText = React.useCallback((input: string, keyPrefix: string) => {
    const segments = parseLinkSegments(input);
    return (
      <>
        {segments.map((seg, i) => {
          if (!seg.text.trim()) {
            return <React.Fragment key={`${keyPrefix}-ws-${i}`}>{seg.text}</React.Fragment>;
          }
          if (!seg.href) {
            return <React.Fragment key={`${keyPrefix}-txt-${i}`}>{seg.text}</React.Fragment>;
          }
          return (
            <a
              key={`${keyPrefix}-lnk-${i}`}
              href={seg.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1d4ed8] underline break-all"
            >
              {seg.text}
            </a>
          );
        })}
      </>
    );
  }, []);

  const renderWordSliceWithLinks = React.useCallback(
    (start: number, end: number, source: string, keyPrefix: string) => {
      if (words.length === 0 || end <= start) {
        return (
          <p className="mt-1 whitespace-pre-wrap break-words">
            {renderLinkedText(source, `${keyPrefix}-fallback`)}
          </p>
        );
      }

      const parts = parseLinkSegments(source);
      let local = 0;
      return (
        <p className="mt-1 whitespace-pre-wrap break-words">
          {parts.map((part, partIdx) => {
            const partSpeech = stripMarkdownForTts(part.text).trim();
            const tokenCount = partSpeech ? partSpeech.split(/\s+/).filter(Boolean).length : 0;
            const segStart = local;
            const segEnd = Math.min(end - start, segStart + tokenCount);
            local = segEnd;
            const segmentWords = words.slice(start + segStart, start + segEnd);

            const segmentContent = (
              <>
                {segmentWords.map((w, i) => {
                  const absoluteIdx = start + segStart + i;
                  return (
                    <React.Fragment key={`${keyPrefix}-${partIdx}-${absoluteIdx}-${w.start}`}>
                      <span
                        className={
                          absoluteIdx === wordIdx
                            ? "rounded bg-amber-200 px-0.5 text-[#1a1a1a] transition-colors"
                            : undefined
                        }
                      >
                        {w.text}
                      </span>{" "}
                    </React.Fragment>
                  );
                })}
              </>
            );

            if (part.href && segmentWords.length > 0) {
              return (
                <a
                  key={`${keyPrefix}-seg-${partIdx}`}
                  href={part.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1d4ed8] underline break-all"
                >
                  {segmentContent}
                </a>
              );
            }
            if (part.href) {
              return (
                <a
                  key={`${keyPrefix}-seg-${partIdx}`}
                  href={part.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1d4ed8] underline break-all"
                >
                  {part.text}{" "}
                </a>
              );
            }
            if (segmentWords.length > 0) {
              return <React.Fragment key={`${keyPrefix}-seg-${partIdx}`}>{segmentContent}</React.Fragment>;
            }
            return (
              <React.Fragment key={`${keyPrefix}-seg-${partIdx}`}>
                {part.text}
              </React.Fragment>
            );
          })}
        </p>
      );
    },
    [renderLinkedText, wordIdx, words]
  );

  const renderFullDigest = React.useCallback(() => {
    if (words.length === 0) {
      return (
        <div className="space-y-2">
          {fullDigestBlocks.map((b, idx) => {
            if (b.kind === "spacer") return <div key={`sp-${idx}`} className="h-2" />;
            if (b.kind === "heading") {
              return (
                <p key={`h-${idx}`} className="text-sm font-semibold text-[#2d2d2d]">
                  {renderLinkedText(b.displayText, `h-${idx}`)}
                </p>
              );
            }
            if (b.kind === "bullet") {
              return (
                <p key={`li-${idx}`} className="text-sm text-[#2d2d2d]">
                  <span className="mr-1">•</span>
                  {renderLinkedText(b.displayText, `li-${idx}`)}
                </p>
              );
            }
            return (
              <p key={`p-${idx}`} className="text-sm text-[#2d2d2d]">
                {renderLinkedText(b.displayText, `p-${idx}`)}
              </p>
            );
          })}
        </div>
      );
    }

    let cursor = boundaryIdx;
    return (
      <div className="space-y-2">
        {fullDigestBlocks.map((b, idx) => {
          if (b.kind === "spacer") {
            return <div key={`sp-${idx}`} className="h-2" />;
          }
          const tokenCount = b.speechText
            ? b.speechText.split(/\s+/).filter(Boolean).length
            : 0;
          const start = cursor;
          const end = Math.min(words.length, start + tokenCount);
          cursor = end;
          const textNode = renderWordSlice(start, end, b.displayText);

          if (b.kind === "heading") {
            return (
              <div key={`h-${idx}`} className="text-sm font-semibold text-[#2d2d2d]">
                {renderWordSliceWithLinks(start, end, b.displayText, `h-${idx}`)}
              </div>
            );
          }
          if (b.kind === "bullet") {
            return (
              <div key={`li-${idx}`} className="flex items-start gap-1 text-sm text-[#2d2d2d]">
                <span className="mt-1">•</span>
                <div className="min-w-0 flex-1">
                  {renderWordSliceWithLinks(start, end, b.displayText, `li-${idx}`)}
                </div>
              </div>
            );
          }
          return (
            <div key={`p-${idx}`} className="text-sm text-[#2d2d2d]">
              {renderWordSliceWithLinks(start, end, b.displayText, `p-${idx}`)}
            </div>
          );
        })}
      </div>
    );
  }, [boundaryIdx, fullDigestBlocks, renderLinkedText, renderWordSliceWithLinks, words]);

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

      <div className="rounded-lg border border-[#d4d4d4] bg-white p-3 text-sm leading-relaxed text-[#1a1a1a]">
        <p className="font-medium text-[#2d2d2d]">TL;DR</p>
        {renderWordSlice(0, boundaryIdx, tldr)}

        <button
          type="button"
          onClick={onToggleExpanded}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#1d4ed8] touch-manipulation"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" /> Read less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" /> Read more
            </>
          )}
        </button>

        {expanded ? (
          <div className="mt-3 border-t border-[#e2e2e2] pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[#555]">Full digest</p>
            <div className="mt-2 text-sm text-[#2d2d2d]">{renderFullDigest()}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
