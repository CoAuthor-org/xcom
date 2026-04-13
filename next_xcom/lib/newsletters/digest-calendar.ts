/**
 * Calendar day for digest versioning (Part 1, Part 2, … per day).
 * Set `NEWSLETTERS_DIGEST_TIMEZONE` to an IANA zone (e.g. `America/New_York`, `Asia/Kolkata`).
 * Defaults to `UTC`.
 */
export function getDigestTimezone(): string {
  const tz = process.env.NEWSLETTERS_DIGEST_TIMEZONE?.trim();
  if (tz) return tz;
  return "UTC";
}

/** YYYY-MM-DD for the digest “edition” day in the configured timezone. */
export function getDigestCalendarDateISO(now: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) {
    throw new Error("Failed to format digest calendar date");
  }
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
