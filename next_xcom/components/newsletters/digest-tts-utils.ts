export type TimedWord = { text: string; start: number; end: number };

export type SentenceRange = {
  start: number;
  end: number;
  startWord: number;
  endWord: number;
};

/** First word whose `end` is past `t` (karaoke-style; clamps to last word). */
export function activeWordIndex(words: TimedWord[], t: number): number {
  if (words.length === 0) return -1;
  for (let i = 0; i < words.length; i++) {
    if (t < words[i].end) return i;
  }
  return words.length - 1;
}

/**
 * Sentence boundaries from word tokens (ends at . ! ? possibly before closing quote).
 */
export function buildSentenceRanges(words: TimedWord[]): SentenceRange[] {
  if (words.length === 0) return [];
  const ranges: SentenceRange[] = [];
  let startWord = 0;
  let startTime = words[0].start;

  for (let i = 0; i < words.length; i++) {
    const raw = words[i].text;
    const trimmed = raw.trimEnd();
    const endsSentence = /[.!?]["']?$/.test(trimmed) || i === words.length - 1;

    if (endsSentence) {
      ranges.push({
        start: startTime,
        end: words[i].end,
        startWord,
        endWord: i,
      });
      if (i < words.length - 1) {
        startWord = i + 1;
        startTime = words[i + 1].start;
      }
    }
  }

  return ranges;
}

/** Index of the sentence range that `t` falls into (by start time ordering). */
export function sentenceIndexAt(ranges: SentenceRange[], t: number): number {
  if (ranges.length === 0) return 0;
  let idx = 0;
  for (let i = 0; i < ranges.length; i++) {
    if (t + 1e-3 >= ranges[i].start) idx = i;
  }
  return idx;
}

export function jumpSentences(
  ranges: SentenceRange[],
  currentTime: number,
  delta: number
): number {
  if (ranges.length === 0) return currentTime;
  const si = sentenceIndexAt(ranges, currentTime);
  const next = Math.max(0, Math.min(ranges.length - 1, si + delta));
  return ranges[next].start;
}
