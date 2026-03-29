export interface ParsedRssItem {
  title: string;
  link: string;
  description: string;
  source: string;
}

const DEFAULT_FEEDS = [
  "https://news.ycombinator.com/rss",
  "https://www.producthunt.com/feed",
];

function stripHtml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textFromTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripHtml(match[1]) : "";
}

function parseRssXml(xml: string, source: string): ParsedRssItem[] {
  const chunks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const rows: ParsedRssItem[] = [];
  for (const item of chunks) {
    const title = textFromTag(item, "title");
    const link = textFromTag(item, "link");
    const description =
      textFromTag(item, "description") || textFromTag(item, "content:encoded");
    if (!title || !link) continue;
    rows.push({ title, link, description, source });
  }
  return rows;
}

export async function fetchLeadFeeds(feedUrls?: string[]): Promise<ParsedRssItem[]> {
  const urls = (feedUrls && feedUrls.length > 0 ? feedUrls : DEFAULT_FEEDS).map((s) =>
    s.trim()
  );
  const all: ParsedRssItem[] = [];
  for (const url of urls) {
    if (!url) continue;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "xcom-scouter-bot/1.0" },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseRssXml(xml, url);
      all.push(...items.slice(0, 30));
    } catch {
      // Ignore per-source errors to keep cron resilient.
    }
  }
  return all;
}
