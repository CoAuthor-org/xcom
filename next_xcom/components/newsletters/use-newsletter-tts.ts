"use client";

import * as React from "react";

/**
 * Browser Web Speech API. Pause is inconsistent across engines; this hook exposes play + stop.
 */
export function useNewsletterTts() {
  const [playing, setPlaying] = React.useState(false);
  /** Which list row or `detail` is driving playback. */
  const [activeTarget, setActiveTarget] = React.useState<string | null>(null);

  const stop = React.useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
    setActiveTarget(null);
  }, []);

  const speak = React.useCallback(
    (text: string, targetId: string | null = null) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        return;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      const trimmed = text.replace(/\s+/g, " ").trim();
      if (!trimmed) return;
      const u = new SpeechSynthesisUtterance(trimmed);
      u.onend = () => {
        setPlaying(false);
        setActiveTarget(null);
      };
      u.onerror = () => {
        setPlaying(false);
        setActiveTarget(null);
      };
      setPlaying(true);
      setActiveTarget(targetId);
      window.speechSynthesis.speak(u);
    },
    []
  );

  React.useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { playing, activeTarget, speak, stop };
}
