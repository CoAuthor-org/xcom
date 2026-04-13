/** Human label: "Sun, Apr 12, 2026 · Part 2" — digest_date is YYYY-MM-DD. */
export function formatDigestVersionLabel(digestDate: string, partNumber: number): string {
  const [ys, ms, ds] = digestDate.split("-");
  const y = Number(ys);
  const mo = Number(ms);
  const da = Number(ds);
  if (!y || !mo || !da) return `Part ${partNumber}`;
  const localNoon = new Date(y, mo - 1, da, 12, 0, 0);
  const dateStr = localNoon.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return `${dateStr} · Part ${partNumber}`;
}
