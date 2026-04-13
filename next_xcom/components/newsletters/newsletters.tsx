"use client";

import * as React from "react";
import {
  Loader2,
  Star,
  Trash2,
  Archive,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Inbox,
  XCircle,
} from "lucide-react";
import { NewsletterDetailDialog } from "./newsletter-detail-dialog";
import { SimpleMarkdown, stripMarkdownForTts } from "./simple-markdown";
import { DigestTtsPlayer } from "./digest-tts-player";
import type {
  NewsletterDigestRow,
  NewsletterDigestSummary,
  NewsletterEmailRow,
  NewsletterListItem,
} from "@/lib/newsletters/types";
import { formatDigestVersionLabel } from "@/lib/newsletters/digest-label";
import { triggerNewsletterDigestSummarizeAction } from "@/app/actions/newsletters-digest";
import { NeuCheckbox } from "@/components/ui/neu-checkbox";

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
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [starredOnly, setStarredOnly] = React.useState(false);
  const [includeUnnecessary, setIncludeUnnecessary] = React.useState(false);
  const [inboxOpen, setInboxOpen] = React.useState(false);
  const [inboxEverOpened, setInboxEverOpened] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [idsLoading, setIdsLoading] = React.useState<null | "filtered" | "all">(null);
  const [bulkBusy, setBulkBusy] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailRow, setDetailRow] = React.useState<NewsletterEmailRow | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [actionBusy, setActionBusy] = React.useState<string | null>(null);
  const [digestSummaries, setDigestSummaries] = React.useState<NewsletterDigestSummary[]>([]);
  const [selectedDigestId, setSelectedDigestId] = React.useState<string | null>(null);
  const [digest, setDigest] = React.useState<NewsletterDigestRow | null>(null);
  const [pendingInWindow, setPendingInWindow] = React.useState(0);
  const [digestListLoading, setDigestListLoading] = React.useState(true);
  const [digestDetailLoading, setDigestDetailLoading] = React.useState(false);
  const [digestExpanded, setDigestExpanded] = React.useState(false);
  const [summarizeBusy, setSummarizeBusy] = React.useState(false);
  const [digestMessage, setDigestMessage] = React.useState("");

  const digestPlainForTts = React.useMemo(() => {
    if (!digest) return "";
    return stripMarkdownForTts(
      `${digest.tldr}\n${digest.summary_markdown}`
    ).slice(0, 50_000);
  }, [digest]);

  const loadDigestList = React.useCallback(async () => {
    setDigestListLoading(true);
    try {
      const res = await fetch("/api/newsletters/digests");
      const data = await res.json();
      if (!res.ok) {
        setDigestSummaries([]);
        setPendingInWindow(0);
        setSelectedDigestId(null);
        return;
      }
      const list = (data.digests ?? []) as NewsletterDigestSummary[];
      setDigestSummaries(list);
      setPendingInWindow(typeof data.pendingInWindow === "number" ? data.pendingInWindow : 0);
      setSelectedDigestId((prev) => {
        if (list.length === 0) return null;
        if (prev && list.some((s) => s.id === prev)) return prev;
        return list[0].id;
      });
    } catch {
      setDigestSummaries([]);
      setPendingInWindow(0);
      setSelectedDigestId(null);
    } finally {
      setDigestListLoading(false);
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
    await loadDigestList();
    if (inboxEverOpened) {
      await fetchPage(0, false);
    }
  }, [loadDigestList, fetchPage, inboxEverOpened]);

  React.useEffect(() => {
    void loadDigestList();
  }, [loadDigestList]);

  React.useEffect(() => {
    setDigestExpanded(false);
  }, [selectedDigestId]);

  React.useEffect(() => {
    if (!selectedDigestId) {
      setDigest(null);
      setDigestDetailLoading(false);
      return;
    }
    setDigest(null);
    let cancelled = false;
    setDigestDetailLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/newsletters/digests/${selectedDigestId}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setDigest(data as NewsletterDigestRow);
        } else {
          setDigest(null);
        }
      } catch {
        if (!cancelled) setDigest(null);
      } finally {
        if (!cancelled) setDigestDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDigestId]);

  React.useEffect(() => {
    if (!inboxEverOpened) return;
    void fetchPage(0, false);
  }, [fetchPage, inboxEverOpened]);

  React.useEffect(() => {
    const onRefresh = () => {
      void refreshAll();
    };
    window.addEventListener("newsletters:refresh", onRefresh);
    return () => {
      window.removeEventListener("newsletters:refresh", onRefresh);
    };
  }, [refreshAll]);

  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [starredOnly, includeUnnecessary]);

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const fetchIdsParams = () => {
    const params = new URLSearchParams();
    if (starredOnly) params.set("starred_only", "1");
    if (includeUnnecessary) params.set("include_unnecessary", "1");
    return params.toString();
  };

  const selectAllFiltered = async () => {
    setIdsLoading("filtered");
    setError("");
    try {
      const q = fetchIdsParams();
      const res = await fetch(`/api/newsletters/ids?${q}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load ids");
        return;
      }
      const ids = (data.ids ?? []) as string[];
      setSelectedIds(new Set(ids));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ids");
    } finally {
      setIdsLoading(null);
    }
  };

  const selectAllMails = async () => {
    setIdsLoading("all");
    setError("");
    try {
      const res = await fetch("/api/newsletters/ids?all=1");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load ids");
        return;
      }
      const ids = (data.ids ?? []) as string[];
      setSelectedIds(new Set(ids));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ids");
    } finally {
      setIdsLoading(null);
    }
  };

  const runBulkAction = async (
    action: "star" | "unstar" | "mark_unnecessary" | "clear_unnecessary" | "delete",
    label: string
  ) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setError("Select at least one email.");
      return;
    }
    if (action === "delete") {
      if (!window.confirm(`Delete ${ids.length} email(s) permanently?`)) return;
    }
    setBulkBusy(action);
    setError("");
    try {
      const res = await fetch("/api/newsletters/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || label + " failed");
        return;
      }
      setSelectedIds(new Set());
      await fetchPage(0, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : label + " failed");
    } finally {
      setBulkBusy(null);
    }
  };

  const deleteRow = async (id: string) => {
    if (!window.confirm("Delete this email permanently?")) return;
    setError("");
    try {
      const res = await fetch(`/api/newsletters/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Delete failed");
        return;
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setItems((prev) => prev.filter((it) => it.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      if (detailRow?.id === id) {
        setDetailOpen(false);
        setDetailRow(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
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
        if ("digestId" in result && result.digestId) {
          setSelectedDigestId(result.digestId);
        }
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
      {error && (
        <div
          className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
          role="alert"
        >
          {error}
        </div>
      )}

      <section
        className="mb-4 rounded-xl border border-[#bebebe] bg-[#ececec] p-4 shadow-[4px_4px_10px_#bebebe,-3px_-3px_8px_#ffffff]"
        aria-labelledby="digest-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="digest-heading" className="text-base font-semibold text-[#2d2d2d] sm:text-lg">
              Digest versions
            </h2>
            <p className="mt-1 text-xs text-[#555] sm:text-sm">Pending: {pendingInWindow}</p>
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
              Build Digest
            </button>
          </div>
        </div>

        {digestMessage && (
          <p className="mt-3 text-sm text-[#2d6a4f]">{digestMessage}</p>
        )}

        {digestListLoading ? (
          <div className="mt-4 flex justify-center py-6">
            <Loader2 className="h-7 w-7 animate-spin text-[#555]" />
          </div>
        ) : digestSummaries.length === 0 ? (
          <p className="mt-4 text-sm text-[#555]">
            No digest yet. When emails arrive, use &quot;Build digest now&quot; or wait for the daily cron.
          </p>
        ) : (
          <div className="mt-4 space-y-3 border-t border-[#bebebe] pt-4">
            <label className="block text-sm font-medium text-[#2d2d2d]" htmlFor="digest-version-select">
              Version
            </label>
            <select
              id="digest-version-select"
              value={selectedDigestId ?? ""}
              onChange={(e) => setSelectedDigestId(e.target.value || null)}
              className="w-full max-w-md rounded-lg border border-[#bebebe] bg-[#fafafa] px-3 py-2 text-sm text-[#2d2d2d] shadow-inner"
            >
              {digestSummaries.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatDigestVersionLabel(s.digest_date, s.part_number)} · {s.email_count} email(s)
                </option>
              ))}
            </select>
            {digestDetailLoading && !digest ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-7 w-7 animate-spin text-[#555]" />
              </div>
            ) : !digest ? (
              <p className="text-sm text-[#555]">Could not load this digest.</p>
            ) : (
              <>
            <p className="text-xs text-[#666]">
              Generated {formatDate(digest.created_at)} · Window{" "}
              {formatDigestPeriod(digest.period_start, digest.period_end)} · {digest.email_count} email(s)
            </p>
            <div className="rounded-lg border border-[#d0d0d0] bg-[#f6f6f6] p-3 text-sm leading-relaxed text-[#2d2d2d]">
              <p className="font-medium">TL;DR</p>
              <p className="mt-1">{digest.tldr}</p>
            </div>
            <DigestTtsPlayer
              key={digest.id}
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
              </>
            )}
          </div>
        )}
      </section>

      <div className="mb-4">
        <button
          type="button"
          onClick={() => {
            setInboxOpen((o) => !o);
            setInboxEverOpened(true);
          }}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#bebebe] bg-[#e8e8e8] px-4 py-3 text-left text-sm font-semibold text-[#2d2d2d] shadow-[4px_4px_10px_#bebebe,-3px_-3px_8px_#ffffff] touch-manipulation"
          aria-expanded={inboxOpen}
        >
          <span className="inline-flex items-center gap-2">
            <Inbox className="h-5 w-5 shrink-0" aria-hidden />
            Inbox
            {inboxEverOpened ? (
              <span className="font-normal text-[#555]">({total} matching filters)</span>
            ) : null}
          </span>
          {inboxOpen ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-[#555]" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-[#555]" aria-hidden />
          )}
        </button>

        {inboxOpen && (
          <div className="mt-3 space-y-4">
            <div className="rounded-xl border border-[#bebebe] bg-[#ececec] p-4 shadow-[4px_4px_10px_#bebebe,-3px_-3px_8px_#ffffff]">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#555]">
                    Filters
                  </h3>
                  <div className="flex flex-col gap-3">
                    <label className="flex cursor-pointer items-center gap-3 text-sm text-[#2d2d2d] touch-manipulation">
                      <NeuCheckbox
                        id="newsletters-starred-only"
                        checked={starredOnly}
                        onCheckedChange={setStarredOnly}
                        aria-label="Starred only"
                      />
                      <span>Starred only</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 text-sm text-[#2d2d2d] touch-manipulation">
                      <NeuCheckbox
                        id="newsletters-include-unnecessary"
                        checked={includeUnnecessary}
                        onCheckedChange={setIncludeUnnecessary}
                        aria-label="Show marked unnecessary"
                      />
                      <span>Show marked unnecessary</span>
                    </label>
                    <p className="text-sm text-[#555]">
                      <span className="font-medium text-[#2d2d2d]">{total}</span> emails match these filters
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => void selectAllFiltered()}
                        disabled={Boolean(idsLoading) || total === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-3 py-2 text-xs font-medium text-[#2d2d2d] shadow-[2px_2px_4px_#bebebe] touch-manipulation disabled:opacity-50 sm:text-sm"
                      >
                        {idsLoading === "filtered" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Select all filtered
                      </button>
                      <button
                        type="button"
                        onClick={() => void selectAllMails()}
                        disabled={Boolean(idsLoading)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-3 py-2 text-xs font-medium text-[#2d2d2d] shadow-[2px_2px_4px_#bebebe] touch-manipulation disabled:opacity-50 sm:text-sm"
                      >
                        {idsLoading === "all" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Select all mails
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        disabled={selectedIds.size === 0}
                        className="inline-flex items-center justify-center rounded-lg border border-[#bebebe] bg-[#dcdcdc] px-3 py-2 text-xs font-medium text-[#2d2d2d] touch-manipulation disabled:opacity-50 sm:text-sm"
                      >
                        Clear selection
                      </button>
                    </div>
                    <p className="text-xs text-[#666]">
                      “Select all filtered” uses every email matching the filters above. “Select all mails”
                      selects every stored email, ignoring those filters.
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#555]">
                    Actions
                  </h3>
                  <p className="mb-2 text-xs text-[#666]">
                    Selected: <span className="font-medium text-[#2d2d2d]">{selectedIds.size}</span>
                  </p>
                  <p className="mb-2 text-xs font-medium text-[#2d2d2d]">On selection</p>
                  <div className="mb-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void runBulkAction("star", "Star")}
                      disabled={Boolean(bulkBusy)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-3 py-2 text-xs font-medium text-[#2d2d2d] touch-manipulation disabled:opacity-50 sm:text-sm"
                    >
                      {bulkBusy === "star" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Star selected
                    </button>
                    <button
                      type="button"
                      onClick={() => void runBulkAction("unstar", "Unstar")}
                      disabled={Boolean(bulkBusy)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-3 py-2 text-xs font-medium text-[#2d2d2d] touch-manipulation disabled:opacity-50 sm:text-sm"
                    >
                      {bulkBusy === "unstar" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Unstar selected
                    </button>
                    <button
                      type="button"
                      onClick={() => void runBulkAction("mark_unnecessary", "Mark unnecessary")}
                      disabled={Boolean(bulkBusy)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-3 py-2 text-xs font-medium text-[#2d2d2d] touch-manipulation disabled:opacity-50 sm:text-sm"
                    >
                      {bulkBusy === "mark_unnecessary" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Mark unnecessary
                    </button>
                    <button
                      type="button"
                      onClick={() => void runBulkAction("clear_unnecessary", "Clear unnecessary")}
                      disabled={Boolean(bulkBusy)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-3 py-2 text-xs font-medium text-[#2d2d2d] touch-manipulation disabled:opacity-50 sm:text-sm"
                    >
                      {bulkBusy === "clear_unnecessary" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Unmark unnecessary
                    </button>
                    <button
                      type="button"
                      onClick={() => void runBulkAction("delete", "Delete")}
                      disabled={Boolean(bulkBusy)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-900 touch-manipulation disabled:opacity-50 sm:text-sm"
                    >
                      {bulkBusy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Delete selected
                    </button>
                  </div>
                  <p className="mb-2 text-xs font-medium text-[#2d2d2d]">Mailbox</p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void runAction("clear_unnecessary")}
                      disabled={Boolean(actionBusy)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-3 py-2 text-xs font-medium text-[#2d2d2d] shadow-[2px_2px_4px_#bebebe] touch-manipulation disabled:opacity-50 sm:text-sm"
                    >
                      {actionBusy === "clear_unnecessary" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                      Clear unnecessary (all)
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAction("purge_old")}
                      disabled={Boolean(actionBusy)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#bebebe] bg-[#e0e0e0] px-3 py-2 text-xs font-medium text-[#2d2d2d] shadow-[2px_2px_4px_#bebebe] touch-manipulation disabled:opacity-50 sm:text-sm"
                    >
                      {actionBusy === "purge_old" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                      Purge unstarred older than 7 days
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {loading && items.length === 0 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#555]" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#555]">No newsletters match these filters.</p>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-[#bebebe] bg-[#e8e8e8] p-3 shadow-[4px_4px_10px_#bebebe,-3px_-3px_8px_#ffffff] sm:p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <div className="flex shrink-0 items-start pt-0.5">
                          <NeuCheckbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleSelect(item.id)}
                            title={selectedIds.has(item.id) ? "Deselect" : "Select"}
                            aria-label={`Select ${item.subject || "email"}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[#2d2d2d]">{item.subject}</span>
                            {!item.batch_digest_id && (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900">
                                Not in digest yet
                              </span>
                            )}
                            {item.unnecessary && (
                              <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs">
                                Unnecessary
                              </span>
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
                            onClick={() => void deleteRow(item.id)}
                            className="rounded-lg border border-[#bebebe] bg-[#e0e0e0] p-2 text-red-800 touch-manipulation"
                            aria-label="Delete email"
                            title="Delete permanently"
                          >
                            <XCircle className="h-4 w-4" />
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
              <div className="flex justify-center">
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
          </div>
        )}
      </div>

      <NewsletterDetailDialog row={detailRow} open={detailOpen} onOpenChange={setDetailOpen} />

      {detailOpen && detailLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <Loader2 className="h-10 w-10 animate-spin text-[#333]" />
        </div>
      )}
    </div>
  );
}
