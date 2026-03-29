"use client";

import * as React from "react";
import type { ScouterYoutubeQueueItem } from "@/lib/scouter/types";

export function NightWatcherInput() {
  const [url, setUrl] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [queue, setQueue] = React.useState<ScouterYoutubeQueueItem[]>([]);
  const [searchResult, setSearchResult] = React.useState<
    Array<{ id: string; title: string; summary: string; similarity?: number }>
  >([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadQueue = React.useCallback(async () => {
    try {
      const res = await fetch("/api/scouter/youtube");
      if (!res.ok) return;
      const data = (await res.json()) as { items?: ScouterYoutubeQueueItem[] };
      setQueue(data.items ?? []);
    } catch {
      // Do not block UI on queue refresh errors.
    }
  }, []);

  React.useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const enqueue = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/scouter/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setUrl("");
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/scouter/knowledge/search?query=${encodeURIComponent(q)}`);
      const data = (await res.json().catch(() => ({}))) as {
        items?: Array<{ id: string; title: string; summary: string; similarity?: number }>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSearchResult(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ display: "grid", gap: 10, marginBottom: 12 }}>
      <article className="sc-table-wrap" style={{ padding: 10 }}>
        <h4 style={{ margin: 0, fontSize: "0.85rem" }}>Night Watcher Queue</h4>
        <p style={{ margin: "6px 0 10px", fontSize: "0.75rem", color: "#6b6b6b" }}>
          Paste a YouTube URL to enqueue transcription and SOP extraction.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="sc-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <button type="button" className="sc-btn primary" onClick={enqueue} disabled={busy}>
            Queue
          </button>
        </div>
        {queue.length > 0 && (
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {queue.slice(0, 3).map((item) => (
              <div key={item.id} style={{ fontSize: "0.74rem", color: "#6b6b6b" }}>
                {item.status} - {item.source_url}
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="sc-table-wrap" style={{ padding: 10 }}>
        <h4 style={{ margin: 0, fontSize: "0.85rem" }}>Knowledge Base Search</h4>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            className="sc-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search SOPs and summaries"
          />
          <button type="button" className="sc-btn" onClick={runSearch} disabled={busy}>
            Search
          </button>
        </div>
        {searchResult.length > 0 && (
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {searchResult.slice(0, 4).map((row) => (
              <div key={row.id} style={{ borderTop: "1px solid rgba(0, 0, 0, 0.08)", paddingTop: 8 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>{row.title}</div>
                <div style={{ fontSize: "0.73rem", color: "#6b6b6b", marginTop: 4 }}>
                  {row.summary}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p style={{ color: "#ff5d6e", fontSize: "0.76rem" }}>{error}</p>}
      </article>
    </section>
  );
}
