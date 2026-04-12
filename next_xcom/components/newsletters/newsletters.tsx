"use client";

import * as React from "react";
import {
  Loader2,
  Mail,
  Star,
  Trash2,
  RefreshCw,
  Archive,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { NewsletterDetailDialog } from "./newsletter-detail-dialog";
import { SimpleMarkdown, stripMarkdownForTts } from "./simple-markdown";
import { DigestTtsPlayer } from "./digest-tts-player";
import type { NewsletterDigestRow, NewsletterEmailRow, NewsletterListItem } from "@/lib/newsletters/types";
import { triggerNewsletterDigestSummarizeAction } from "@/app/actions/newsletters-digest";

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

function formatDigestPeriod(start: string, end: string): string {
  return `${formatDate(start)} → ${formatDate(end)}`;
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
  const [digest, setDigest] = React.useState<NewsletterDigestRow | null>(null);
  const [pendingInWindow, setPendingInWindow] = React.useState(0);
  const [digestLoading, setDigestLoading] = React.useState(true);
  const [digestExpanded, setDigestExpanded] = React.useState(false);
  const [summarizeBusy, setSummarizeBusy] = React.useState(false);
  const [digestMessage, setDigestMessage] = React.useState("");

  const digestPlainForTts = React.useMemo(() => {
    if (!digest) return "";
    return stripMarkdownForTts(
      `${digest.tldr}\n${digest.summary_markdown}`
    ).slice(0, 50_000);
  }, [digest]);

  const loadDigest = React.useCallback(async () => {
    setDigestLoading(true);
    try {
      const res = await fetch("/api/newsletters/digest/latest");
      const data = await res.json();
      if (!res.ok) {
        setDigest(null);
        setPendingInWindow(0);
        return;
      }
      setDigest(data.digest ?? null);
      setPendingInWindow(typeof data.pendingInWindow === "number" ? data.pendingInWindow : 0);
    } catch {
      setDigest(null);
      setPendingInWindow(0);
    } finally {
      setDigestLoading(false);
    }
  }, []);

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

  const refreshAll = React.useCallback(async () => {
    await Promise.all([loadDigest(), fetchPage(0, false)]);
  }, [loadDigest, fetchPage]);

  React.useEffect(() => {
    void loadDigest();
  }, [loadDigest]);

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
                link_primary: row.link_primary ?? it.link_primary,
                batch_digest_id: row.batch_digest_id ?? it.batch_digest_id,
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
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionBusy(null);
    }
  };

  const runSummarizeNow = async () => {
    setSummarizeBusy(true);
    setDigestMessage("");
    setError("");
    try {
      const result = await triggerNewsletterDigestSummarizeAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.skipped) {
        setDigestMessage(result.message);
      } else {
        setDigestMessage(`Digest built from ${result.emailCount} email(s).`);
      }
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Summarize failed");
    } finally {
      setSummarizeBusy(false);
    }
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
            onClick={() => void refreshAll()}
            disabled={loading || digestLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-3 py-2 text-sm font-medium text-[#2d2d2d] shadow-[3px_3px_6px_#bebebe,-2px_-2px_5px_#ffffff] hover:shadow-[inset_2px_2px_5px_#bebebe] disabled:opacity-50 touch-manipulation"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading || digestLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-[#444]">
        New emails are stored only. Once per day (or when you click the button), one digest summarizes every
        unsummarized email from the last 24 hours. Ingest via Zapier POST to{" "}
        <code className="rounded bg-[#d8d8d8] px-1">/api/webhooks/newsletters</code>. Unstarred items older
        than a week are removed by the cleanup cron. Playback uses Edge neural TTS with a live transcript
        highlight (word timings from the same synthesis).
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
        <span className="text-sm text-[#555] sm:ml-auto">{total} emails</span>
      </div>

      <section
        className="mb-4 rounded-xl border border-[#bebebe] bg-[#ececec] p-4 shadow-[4px_4px_10px_#bebebe,-3px_-3px_8px_#ffffff]"
        aria-labelledby="digest-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="digest-heading" className="text-base font-semibold text-[#2d2d2d] sm:text-lg">
              Latest 24h digest
            </h2>
            <p className="mt-1 text-xs text-[#555] sm:text-sm">
              One AI summary for all emails collected in the ingest window. Pending (not yet in a digest) in
              the last 24h: <span className="font-medium text-[#2d2d2d]">{pendingInWindow}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runSummarizeNow()}
              disabled={summarizeBusy}
              className="inline-flex items-center gap-2 rounded-lg border border-[#bebebe] bg-[#2d2d2d] px-3 py-2 text-sm font-medium text-white shadow-md touch-manipulation disabled:opacity-50"
            >
              {summarizeBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Build digest now
            </button>
          </div>
        </div>

        {digestMessage && (
          <p className="mt-3 text-sm text-[#2d6a4f]">{digestMessage}</p>
        )}

        {digestLoading ? (
          <div className="mt-4 flex justify-center py-6">
            <Loader2 className="h-7 w-7 animate-spin text-[#555]" />
          </div>
        ) : !digest ? (
          <p className="mt-4 text-sm text-[#555]">
            No digest yet. When emails arrive, use &quot;Build digest now&quot; or wait for the daily cron.
          </p>
        ) : (
          <div className="mt-4 space-y-3 border-t border-[#bebebe] pt-4">
            <p className="text-xs text-[#666]">
              Generated {formatDate(digest.created_at)} · Window{" "}
              {formatDigestPeriod(digest.period_start, digest.period_end)} · {digest.email_count} email(s)
            </p>
            <div className="rounded-lg border border-[#d0d0d0] bg-[#f6f6f6] p-3 text-sm leading-relaxed text-[#2d2d2d]">
              <p className="font-medium">TL;DR</p>
              <p className="mt-1">{digest.tldr}</p>
            </div>
            <DigestTtsPlayer
              digestId={digest.id}
              plainText={digestPlainForTts}
              onError={(m) => setError(m)}
            />
            <button
              type="button"
              onClick={() => setDigestExpanded((e) => !e)}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#1d4ed8] touch-manipulation"
            >
              {digestExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" /> Hide full digest
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" /> Show full digest
                </>
              )}
            </button>
            {digestExpanded && (
              <div className="rounded-lg border border-[#d0d0d0] bg-[#fafafa] p-3">
                <SimpleMarkdown source={digest.summary_markdown} />
              </div>
            )}
          </div>
        )}
      </section>

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

      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#555]">Inbox</h3>

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
                    {!item.batch_digest_id && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900">
                        Not in digest yet
                      </span>
                    )}
                    {item.unnecessary && (
                      <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs">Unnecessary</span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-[#555] sm:text-sm">
                    {item.from_address} · {formatDate(item.received_at || item.created_at)}
                  </p>
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
    </div>
  );
}
