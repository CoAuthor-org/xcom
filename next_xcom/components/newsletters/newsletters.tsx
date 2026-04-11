"use client";

import * as React from "react";
import {
  Loader2,
  Mail,
  Pause,
  Play,
  Star,
  Trash2,
  RefreshCw,
  Archive,
  Clock,
} from "lucide-react";
import { NewsletterDetailDialog } from "./newsletter-detail-dialog";
import { SimpleMarkdown, stripMarkdownForTts } from "./simple-markdown";
import { useNewsletterTts } from "./use-newsletter-tts";
import type { NewsletterEmailRow } from "@/lib/newsletters/types";
import type { NewsletterListItem } from "@/lib/newsletters/types";

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Newsletters() {
  const [items, setItems] = React.useState<NewsletterListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [limit] = React.useState(25);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [starredOnly, setStarredOnly] = React.useState(false);
  const [includeUnnecessary, setIncludeUnnecessary] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailRow, setDetailRow] = React.useState<NewsletterEmailRow | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [actionBusy, setActionBusy] = React.useState<string | null>(null);

  const { playing, activeTarget, speak, stop } = useNewsletterTts();

  React.useEffect(() => {
    if (!detailOpen && activeTarget === "detail") {
      stop();
    }
  }, [detailOpen, activeTarget, stop]);

  const fetchPage = React.useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
          ...(starredOnly ? { starred_only: "1" } : {}),
          ...(includeUnnecessary ? { include_unnecessary: "1" } : {}),
        });
        const res = await fetch(`/api/newsletters?${params}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || res.statusText);
          if (!append) {
            setItems([]);
            setTotal(0);
          }
          return;
        }
        const page = (data.items || []) as NewsletterListItem[];
        setTotal(typeof data.total === "number" ? data.total : 0);
        if (append) {
          setItems((prev) => [...prev, ...page]);
        } else {
          setItems(page);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
        if (!append) {
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [limit, starredOnly, includeUnnecessary]
  );

  React.useEffect(() => {
    void fetchPage(0, false);
  }, [fetchPage]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    setDetailRow(null);
    try {
      const res = await fetch(`/api/newsletters/${id}`);
      const data = await res.json();
      if (res.ok) {
        setDetailRow(data as NewsletterEmailRow);
      } else {
        setDetailRow(null);
        setError(data.error || "Failed to load detail");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const patchItem = async (id: string, patch: { starred?: boolean; unnecessary?: boolean }) => {
    try {
      const res = await fetch(`/api/newsletters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as NewsletterEmailRow & { error?: string };
      if (!res.ok) {
        setError(data.error || "Update failed");
        return;
      }
      const row = data as NewsletterEmailRow;
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                starred: row.starred,
                unnecessary: row.unnecessary,
                tldr: row.tldr ?? it.tldr,
                summary_status: row.summary_status ?? it.summary_status,
                link_primary: row.link_primary ?? it.link_primary,
              }
            : it
        )
      );
      if (detailRow?.id === id) {
        setDetailRow(row);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const runAction = async (type: "clear_unnecessary" | "purge_old") => {
    const label = type === "clear_unnecessary" ? "clear unnecessary" : "purge old";
    if (!window.confirm(`Run “${label}”? This cannot be undone for deleted rows.`)) return;
    setActionBusy(type);
    setError("");
    try {
      const res = await fetch("/api/newsletters/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Action failed");
        return;
      }
      await fetchPage(0, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionBusy(null);
    }
  };

  const playSummary = (item: NewsletterListItem) => {
    const tldrPlain = item.tldr ? stripMarkdownForTts(item.tldr) : "";
    const parts = [item.subject, tldrPlain].filter(Boolean);
    if (item.link_primary) parts.push("Link: " + item.link_primary);
    speak(parts.join(". "), item.id);
  };

  const playDetailTts = () => {
    if (!detailRow) return;
    const md = [detailRow.tldr, detailRow.summary_markdown || ""].filter(Boolean).join("\n");
    const text =
      detailRow.subject +
      ". " +
      stripMarkdownForTts(md) +
      (detailRow.link_primary ? ". Link: " + detailRow.link_primary : "");
    speak(text, "detail");
  };

  const hasMore = items.length < total;

  return (
    <div className="newsletters-panel mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-6 w-6 shrink-0 text-[#2d2d2d]" aria-hidden />
          <h1 className="text-xl font-bold text-[#2d2d2d] sm:text-2xl">Newsletters</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchPage(0, false)}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-3 py-2 text-sm font-medium text-[#2d2d2d] shadow-[3px_3px_6px_#bebebe,-2px_-2px_5px_#ffffff] hover:shadow-[inset_2px_2px_5px_#bebebe] disabled:opacity-50 touch-manipulation"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-[#444]">
        Ingest via Zapier POST to <code className="rounded bg-[#d8d8d8] px-1">/api/webhooks/newsletters</code>{" "}
        with your secret header. Unstarred items older than one week are removed by the cleanup cron;
        starred items are kept.
      </p>

      {error && (
        <div
          className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#bebebe] bg-[#e8e8e8] p-3 shadow-[4px_4px_10px_#bebebe,-3px_-3px_8px_#ffffff] sm:flex-row sm:flex-wrap sm:items-center">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#2d2d2d] touch-manipulation">
          <input
            type="checkbox"
            checked={starredOnly}
            onChange={(e) => {
              setStarredOnly(e.target.checked);
            }}
            className="h-4 w-4 rounded border-[#888]"
          />
          Starred only
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#2d2d2d] touch-manipulation">
          <input
            type="checkbox"
            checked={includeUnnecessary}
            onChange={(e) => {
              setIncludeUnnecessary(e.target.checked);
            }}
            className="h-4 w-4 rounded border-[#888]"
          />
          Show marked unnecessary
        </label>
        <span className="text-sm text-[#555] sm:ml-auto">{total} total</span>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => void runAction("clear_unnecessary")}
          disabled={Boolean(actionBusy)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-3 py-2 text-sm font-medium text-[#2d2d2d] shadow-[3px_3px_6px_#bebebe] touch-manipulation disabled:opacity-50"
        >
          {actionBusy === "clear_unnecessary" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          Clear unnecessary
        </button>
        <button
          type="button"
          onClick={() => void runAction("purge_old")}
          disabled={Boolean(actionBusy)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-3 py-2 text-sm font-medium text-[#2d2d2d] shadow-[3px_3px_6px_#bebebe] touch-manipulation disabled:opacity-50"
        >
          {actionBusy === "purge_old" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          Purge unstarred older than 7 days
        </button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#555]" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-[#555]">No newsletters yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-[#bebebe] bg-[#e8e8e8] p-3 shadow-[4px_4px_10px_#bebebe,-3px_-3px_8px_#ffffff] sm:p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#2d2d2d]">{item.subject}</span>
                    {item.summary_status === "pending" && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                        Pending
                      </span>
                    )}
                    {item.summary_status === "error" && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-900">
                        Error
                      </span>
                    )}
                    {item.unnecessary && (
                      <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs">Unnecessary</span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-[#555] sm:text-sm">
                    {item.from_address} · {formatDate(item.received_at || item.created_at)}
                  </p>
                  {item.tldr && (
                    <div className="mt-2 text-sm leading-relaxed text-[#333]">
                      <SimpleMarkdown source={item.tldr} />
                    </div>
                  )}
                  {item.link_primary && (
                    <a
                      href={item.link_primary}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-[#1d4ed8] underline break-all"
                    >
                      Open link
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1 sm:flex-col sm:items-end">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => void patchItem(item.id, { starred: !item.starred })}
                      className={`rounded-lg border p-2 touch-manipulation ${
                        item.starred
                          ? "border-amber-500 bg-amber-100 text-amber-900"
                          : "border-[#bebebe] bg-[#e0e0e0] text-[#2d2d2d]"
                      }`}
                      aria-label={item.starred ? "Unstar" : "Star"}
                      title={item.starred ? "Unstar" : "Star (keep forever)"}
                    >
                      <Star className={`h-4 w-4 ${item.starred ? "fill-current" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void patchItem(item.id, { unnecessary: !item.unnecessary })}
                      className="rounded-lg border border-[#bebebe] bg-[#e0e0e0] p-2 text-[#2d2d2d] touch-manipulation"
                      aria-label="Toggle unnecessary"
                      title="Mark unnecessary"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        playing && activeTarget === item.id ? stop() : playSummary(item)
                      }
                      className="rounded-lg border border-[#bebebe] bg-[#e0e0e0] p-2 text-[#2d2d2d] touch-manipulation"
                      aria-label={
                        playing && activeTarget === item.id ? "Stop speech" : "Play summary"
                      }
                      title="Listen (TTS)"
                    >
                      {playing && activeTarget === item.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void openDetail(item.id)}
                    className="mt-1 w-full rounded-lg border border-[#bebebe] bg-[#dcdcdc] px-3 py-1.5 text-xs font-medium text-[#2d2d2d] shadow-[2px_2px_4px_#bebebe] sm:w-auto sm:text-sm touch-manipulation"
                  >
                    More details
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void fetchPage(items.length, true)}
            disabled={loadingMore}
            className="rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-4 py-2 text-sm font-medium text-[#2d2d2d] touch-manipulation disabled:opacity-50"
          >
            {loadingMore ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </span>
            ) : (
              "Load more"
            )}
          </button>
        </div>
      )}

      <NewsletterDetailDialog row={detailRow} open={detailOpen} onOpenChange={setDetailOpen} />

      {detailOpen && detailLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <Loader2 className="h-10 w-10 animate-spin text-[#333]" />
        </div>
      )}

      {detailRow && detailOpen && !detailLoading && (
        <div className="fixed bottom-4 left-1/2 z-[55] flex -translate-x-1/2 gap-2 rounded-full border border-[#bebebe] bg-[#e8e8e8] px-3 py-2 shadow-lg sm:bottom-6">
          <button
            type="button"
            onClick={() =>
              playing && activeTarget === "detail" ? stop() : playDetailTts()
            }
            className="inline-flex items-center gap-2 rounded-lg bg-[#2d2d2d] px-4 py-2 text-sm font-medium text-white touch-manipulation"
          >
            {playing && activeTarget === "detail" ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {playing && activeTarget === "detail" ? "Stop" : "Listen"}
          </button>
        </div>
      )}
    </div>
  );
}
