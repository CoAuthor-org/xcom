"use client";

import * as React from "react";
import {
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Trash2,
  CircleCheck,
  Bookmark,
  Sparkles,
  Send,
} from "lucide-react";
import "./x-engager.css";
import { QueryBuilderPanel } from "./query-builder-panel";
import { NeuCheckbox } from "@/components/ui/neu-checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildQueryStringFromOptions,
  defaultQueryOptions,
  parseQueryOptions,
  type QueryOptionsV1,
} from "@/lib/x-query-assembler";
import { useLocalStorageStringState } from "@/lib/use-local-storage-state";
import { useAppSync } from "@/lib/app-sync";

const XE_MAIN_TABS = ["replies", "queries"] as const;
const XE_REPLIES_SUB_TABS = ["outbound", "inbound"] as const;

const SERVER_UNREACHABLE_MSG =
  'Server not reachable. Run "npm start" and open http://localhost:3000';

interface PendingReply {
  id: string;
  tweet_id: string;
  original_text: string;
  author_username: string;
  post_url: string;
  generated_reply: string;
  status: string;
  created_at: string;
  processed_at: string | null;
}

interface RepliesMeta {
  todayCount: number;
  dailyCap: number;
  lastDiscoverAt: string | null;
  lastDiscoverError: string | null;
}

interface SearchQueryRow {
  id: string;
  name: string;
  query_string: string;
  is_active: boolean;
  created_at: string;
  query_options?: unknown;
}

interface InboundMentionEmbed {
  id: string;
  author_id: string;
  author_username: string;
  text: string;
  conversation_id: string | null;
  in_reply_to_tweet_id: string | null;
  created_at: string;
}

interface InboundQueueItem {
  id: string;
  mention_id: string;
  original_context: Record<string, unknown>;
  grok_suggestion: string;
  edited_reply: string | null;
  status: string;
  posted_tweet_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  incoming_mentions: InboundMentionEmbed | InboundMentionEmbed[] | null;
}

interface InboundPollMeta {
  lastMentionsPollAt: string | null;
  lastMentionsPollError: string | null;
  lastMentionsSinceId: string | null;
}

interface DiscoverApiResult {
  inserted?: number;
  candidateCount?: number;
  skippedDueToCap?: boolean;
  errors?: string[];
  batch?: string;
  dailyCountBefore?: number;
}

function previewText(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function normalizeInboundMention(
  m: InboundMentionEmbed | InboundMentionEmbed[] | null
): InboundMentionEmbed | null {
  if (!m) return null;
  return Array.isArray(m) ? m[0] ?? null : m;
}

export function XEngager() {
  const [tab, setTab] = useLocalStorageStringState<
    (typeof XE_MAIN_TABS)[number]
  >("xcom:xengager:mainTab", "replies", XE_MAIN_TABS);
  const [repliesSubTab, setRepliesSubTab] = useLocalStorageStringState<
    (typeof XE_REPLIES_SUB_TABS)[number]
  >("xcom:xengager:repliesSubTab", "outbound", XE_REPLIES_SUB_TABS);
  const [replies, setReplies] = React.useState<PendingReply[]>([]);
  const [meta, setMeta] = React.useState<RepliesMeta | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("pending");
  const [todayOnly, setTodayOnly] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [discoverLoading, setDiscoverLoading] = React.useState(false);
  const [clearingDone, setClearingDone] = React.useState(false);
  const [discoverSummary, setDiscoverSummary] = React.useState<string | null>(
    null
  );
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const [queries, setQueries] = React.useState<SearchQueryRow[]>([]);
  const [qLoading, setQLoading] = React.useState(true);
  const [qName, setQName] = React.useState("");
  const [qString, setQString] = React.useState("");
  const [editingQuery, setEditingQuery] = React.useState<SearchQueryRow | null>(
    null
  );
  const [queryOptions, setQueryOptions] = React.useState<QueryOptionsV1>(() =>
    defaultQueryOptions()
  );
  const [builderActive, setBuilderActive] = React.useState(false);

  const [generateModalOpen, setGenerateModalOpen] = React.useState(false);
  const [scoutTab, setScoutTab] = React.useState<"topic" | "suggest">("topic");
  const [scoutTopicInput, setScoutTopicInput] = React.useState("");
  const [scoutBusy, setScoutBusy] = React.useState(false);
  const [scoutError, setScoutError] = React.useState<string | null>(null);
  const [scoutSuggestions, setScoutSuggestions] = React.useState<
    { label: string; rationale: string }[] | null
  >(null);

  const [inboundItems, setInboundItems] = React.useState<InboundQueueItem[]>(
    []
  );
  const [inboundMeta, setInboundMeta] = React.useState<InboundPollMeta | null>(
    null
  );
  const [inboundLoading, setInboundLoading] = React.useState(true);
  const [inboundStatusFilter, setInboundStatusFilter] =
    React.useState<string>("pending_review");
  const [inboundPollingNow, setInboundPollingNow] = React.useState(false);
  const [clearingInboundAll, setClearingInboundAll] = React.useState(false);
  const [clearingInboundPostedManual, setClearingInboundPostedManual] =
    React.useState(false);

  const loadReplies = React.useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (todayOnly) params.set("today", "1");
      const q = params.toString();
      const res = await fetch(`/api/pending-replies${q ? `?${q}` : ""}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || res.statusText);
      }
      const data = (await res.json()) as {
        replies: PendingReply[];
        meta: {
          todayCount: number;
          dailyCap: number;
          lastDiscoverAt: string | null;
          lastDiscoverError: string | null;
        };
      };
      setReplies(data.replies);
      setMeta({
        todayCount: data.meta.todayCount,
        dailyCap: data.meta.dailyCap,
        lastDiscoverAt: data.meta.lastDiscoverAt,
        lastDiscoverError: data.meta.lastDiscoverError,
      });
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : SERVER_UNREACHABLE_MSG
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, todayOnly]);

  const loadInbound = React.useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (inboundStatusFilter) params.set("status", inboundStatusFilter);
      const q = params.toString();
      const res = await fetch(`/api/inbound-replies${q ? `?${q}` : ""}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || res.statusText);
      }
      const data = (await res.json()) as {
        items: InboundQueueItem[];
        meta: InboundPollMeta;
      };
      setInboundItems(data.items ?? []);
      setInboundMeta(data.meta ?? null);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : SERVER_UNREACHABLE_MSG
      );
    } finally {
      setInboundLoading(false);
    }
  }, [inboundStatusFilter]);

  const loadQueries = React.useCallback(async () => {
    try {
      const res = await fetch("/api/queries");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || res.statusText);
      }
      const data = (await res.json()) as { queries: SearchQueryRow[] };
      setQueries(data.queries);
    } catch (e) {
      console.error(e);
    } finally {
      setQLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  React.useEffect(() => {
    if (tab === "queries") loadQueries();
  }, [tab, loadQueries]);

  React.useEffect(() => {
    if (tab === "replies" && repliesSubTab === "inbound") {
      setInboundLoading(true);
      loadInbound();
    }
  }, [tab, repliesSubTab, loadInbound]);

  useAppSync(() => {
    if (tab === "queries") {
      void loadQueries();
      return;
    }
    void loadReplies();
    if (repliesSubTab === "inbound") {
      void loadInbound();
    }
  });

  React.useEffect(() => {
    if (builderActive) {
      try {
        setQString(buildQueryStringFromOptions(queryOptions));
      } catch {
        /* ignore */
      }
    }
  }, [queryOptions, builderActive]);

  const openScoutModal = () => {
    setScoutError(null);
    setScoutSuggestions(null);
    setGenerateModalOpen(true);
  };

  const runScoutFromTopic = async () => {
    const topic = scoutTopicInput.trim();
    if (!topic) {
      setScoutError("Enter a topic or seed phrase.");
      return;
    }
    setScoutBusy(true);
    setScoutError(null);
    try {
      const res = await fetch("/api/queries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "from_topic", topic }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        name?: string;
        query_string?: string;
        query_options?: QueryOptionsV1;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      if (data.name) setQName(data.name);
      if (data.query_options) {
        setQueryOptions(data.query_options);
        setBuilderActive(true);
        setQString(buildQueryStringFromOptions(data.query_options));
      } else if (data.query_string) {
        setQString(data.query_string);
        setBuilderActive(false);
      }
      setGenerateModalOpen(false);
      setScoutTopicInput("");
    } catch (e) {
      setScoutError(e instanceof Error ? e.message : String(e));
    } finally {
      setScoutBusy(false);
    }
  };

  const runScoutSuggest = async () => {
    setScoutBusy(true);
    setScoutError(null);
    try {
      const res = await fetch("/api/queries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "suggest_topics" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        suggestions?: { label: string; rationale: string }[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      setScoutSuggestions(data.suggestions ?? []);
    } catch (e) {
      setScoutError(e instanceof Error ? e.message : String(e));
    } finally {
      setScoutBusy(false);
    }
  };

  const applyScoutSuggestion = async (label: string) => {
    setScoutBusy(true);
    setScoutError(null);
    try {
      const res = await fetch("/api/queries/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "from_topic", topic: label }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        name?: string;
        query_string?: string;
        query_options?: QueryOptionsV1;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      if (data.name) setQName(data.name);
      if (data.query_options) {
        setQueryOptions(data.query_options);
        setBuilderActive(true);
        setQString(buildQueryStringFromOptions(data.query_options));
      } else if (data.query_string) {
        setQString(data.query_string);
        setBuilderActive(false);
      }
      setGenerateModalOpen(false);
      setScoutSuggestions(null);
    } catch (e) {
      setScoutError(e instanceof Error ? e.message : String(e));
    } finally {
      setScoutBusy(false);
    }
  };

  const runDiscover = async () => {
    setDiscoverLoading(true);
    setError(null);
    setDiscoverSummary(null);
    const started = performance.now();
    console.info("[X Engager] Discover started (batch=manual)…");
    try {
      const res = await fetch("/api/discover-posts?batch=manual", {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as
        | DiscoverApiResult
        | { error?: string };
      const ms = Math.round(performance.now() - started);
      if (!res.ok) {
        console.error("[X Engager] Discover failed", res.status, data);
        throw new Error(
          (data as { error?: string }).error || res.statusText
        );
      }
      const d = data as DiscoverApiResult;
      console.info("[X Engager] Discover response:", {
        ...d,
        durationMs: ms,
        httpStatus: res.status,
      });
      const lines: string[] = [];
      lines.push(
        `${d.inserted ?? 0} new draft(s) saved (HTTP ${res.status}, ${ms}ms).`
      );
      lines.push(
        `Batch: ${d.batch ?? "manual"} · Today’s count before run: ${d.dailyCountBefore ?? "—"}`
      );
      if (d.candidateCount != null) {
        lines.push(
          `X recent search returned ${d.candidateCount} tweet(s) (after dedupe).`
        );
      }
      if (d.skippedDueToCap) {
        lines.push(
          "Daily cap was already reached — nothing could be added this run."
        );
      }
      if ((d.errors?.length ?? 0) > 0) {
        lines.push(
          `Issues (${d.errors!.length}):`,
          ...d.errors!.map((e, i) => `  ${i + 1}. ${e}`)
        );
      } else if ((d.inserted ?? 0) === 0 && !d.skippedDueToCap) {
        if ((d.candidateCount ?? 0) === 0) {
          lines.push(
            "Nothing to draft: X returned no tweets for your active query/queries. Try a broader query, check Advanced Search syntax for the API, or note that Recent Search only covers the last ~7 days."
          );
        } else {
          lines.push(
            "No new rows saved: every candidate may already exist in pending_replies (duplicate tweet), or Grok/insert failed — see Issues if listed above."
          );
        }
      }
      setDiscoverSummary(lines.join("\n"));
      await loadReplies();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[X Engager] Discover error:", e);
      setError(msg);
    } finally {
      setDiscoverLoading(false);
      console.info("[X Engager] Discover finished.");
    }
  };

  const updateReplyLocal = (id: string, patch: Partial<PendingReply>) => {
    setReplies((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const saveReplyText = async (id: string, generated_reply: string) => {
    const res = await fetch(`/api/pending-replies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generated_reply }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error || "Save failed");
    }
    const j = (await res.json()) as { reply: PendingReply };
    updateReplyLocal(id, j.reply);
  };

  const setStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/pending-replies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error || "Update failed");
    }
    const j = (await res.json()) as { reply: PendingReply };
    updateReplyLocal(id, j.reply);
  };

  const regenerate = async (id: string) => {
    const res = await fetch(`/api/pending-replies/${id}/regenerate`, {
      method: "POST",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error || "Regenerate failed");
    }
    const j = (await res.json()) as { reply: PendingReply };
    updateReplyLocal(id, j.reply);
  };

  const removeReply = async (id: string) => {
    const res = await fetch(`/api/pending-replies/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error || "Delete failed");
    }
    setReplies((prev) => prev.filter((r) => r.id !== id));
  };

  const copyAndFlash = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Clipboard not available");
    }
  };

  const clearDoneReplies = async () => {
    if (
      !confirm(
        "Delete every reply marked Done from the database? This cannot be undone."
      )
    ) {
      return;
    }
    setClearingDone(true);
    setError(null);
    try {
      const res = await fetch("/api/pending-replies?bulk=done", {
        method: "DELETE",
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        deleted?: number;
      };
      if (!res.ok) {
        throw new Error(j.error || "Delete failed");
      }
      await loadReplies();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setClearingDone(false);
    }
  };

  const updateInboundLocal = (id: string, patch: Partial<InboundQueueItem>) => {
    setInboundItems((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const saveInboundDraft = async (id: string, edited_reply: string) => {
    const res = await fetch(`/api/inbound-replies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edited_reply }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error || "Save failed");
    }
    const j = (await res.json()) as { item: InboundQueueItem };
    updateInboundLocal(id, j.item);
  };

  const setInboundStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/inbound-replies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error || "Update failed");
    }
    const j = (await res.json()) as { item: InboundQueueItem };
    updateInboundLocal(id, j.item);
  };

  const postInboundReply = async (id: string, text?: string) => {
    const res = await fetch(`/api/inbound-replies/${id}/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(text != null && text !== "" ? { text } : {}),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error || "Post failed");
    }
    const j = (await res.json()) as { item: InboundQueueItem };
    updateInboundLocal(id, j.item);
  };

  const regenerateInbound = async (id: string) => {
    const res = await fetch(`/api/inbound-replies/${id}/regenerate`, {
      method: "POST",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error((j as { error?: string }).error || "Regenerate failed");
    }
    const j = (await res.json()) as { item: InboundQueueItem };
    updateInboundLocal(id, j.item);
  };

  const pollInboundNow = async () => {
    setInboundPollingNow(true);
    setError(null);
    try {
      const res = await fetch("/api/cron/poll-mentions", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        inserted?: number;
      };
      if (!res.ok) {
        throw new Error(j.error || "Fetch inbound failed");
      }
      await loadInbound();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Fetch inbound failed. If CRON_SECRET is set, this button requires a server-side proxy."
      );
    } finally {
      setInboundPollingNow(false);
    }
  };

  const clearInboundAll = async () => {
    if (
      !confirm(
        "Delete all inbound replies? This clears the inbound list only (outbound is not affected)."
      )
    ) {
      return;
    }
    setClearingInboundAll(true);
    setError(null);
    try {
      const res = await fetch("/api/inbound-replies?bulk=all", {
        method: "DELETE",
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        deleted?: number;
      };
      if (!res.ok) {
        throw new Error(j.error || "Delete failed");
      }
      await loadInbound();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setClearingInboundAll(false);
    }
  };

  const clearInboundPostedManual = async () => {
    if (
      !confirm(
        "Delete inbound replies with status Posted or Manual? Outbound replies are not affected."
      )
    ) {
      return;
    }
    setClearingInboundPostedManual(true);
    setError(null);
    try {
      const res = await fetch("/api/inbound-replies?bulk=posted_manual", {
        method: "DELETE",
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        deleted?: number;
      };
      if (!res.ok) {
        throw new Error(j.error || "Delete failed");
      }
      await loadInbound();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setClearingInboundPostedManual(false);
    }
  };

  const submitQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    const qs = builderActive
      ? buildQueryStringFromOptions(queryOptions)
      : qString.trim();
    if (!qName.trim() || !qs) return;
    if (qs.length > 512) {
      alert("Query string exceeds 512 characters. Tighten filters or words.");
      return;
    }
    const payload: Record<string, unknown> = {
      name: qName.trim(),
      query_string: qs,
    };
    if (builderActive) {
      payload.query_options = queryOptions;
    } else {
      payload.query_options = null;
    }
    if (editingQuery) {
      const res = await fetch(`/api/queries/${editingQuery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as { error?: string }).error || "Failed");
        return;
      }
      setEditingQuery(null);
    } else {
      const res = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as { error?: string }).error || "Failed");
        return;
      }
    }
    setQName("");
    setQString("");
    setQueryOptions(defaultQueryOptions());
    setBuilderActive(false);
    loadQueries();
  };

  const deleteQuery = async (id: string) => {
    if (!confirm("Delete this saved query?")) return;
    const res = await fetch(`/api/queries/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert((j as { error?: string }).error || "Failed");
      return;
    }
    loadQueries();
  };

  const toggleQueryActive = async (row: SearchQueryRow) => {
    const res = await fetch(`/api/queries/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !row.is_active }),
    });
    if (!res.ok) return;
    loadQueries();
  };

  const cap = meta?.dailyCap ?? 10;
  const today = meta?.todayCount ?? 0;
  const progressPct = Math.min(100, (today / cap) * 100);

  return (
    <div className="x-engager">
      <div className="x-engager-top">
        <div>
          <h1 className="x-engager-title">X Engager</h1>
          <p className="x-engager-sub">
            Review Grok drafts, copy, and post on X manually (no auto-posting).
          </p>
        </div>
        <div className="x-engager-progress-wrap">
          <div className="x-engager-progress-label">
            <span>Today (IST)</span>
            <span>
              {today} / {cap}
            </span>
          </div>
          <div className="x-engager-progress-bar">
            <div
              className="x-engager-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {meta?.lastDiscoverAt && (
            <div className="x-engager-meta">
              Last discover:{" "}
              {new Date(meta.lastDiscoverAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
          )}
          {meta?.lastDiscoverError && (
            <div className="x-engager-meta err">
              Last run issues: {meta.lastDiscoverError}
            </div>
          )}
        </div>
        <button
          type="button"
          className="xe-btn primary"
          onClick={() => runDiscover()}
          disabled={discoverLoading}
        >
          <RefreshCw
            className={discoverLoading ? "animate-spin" : ""}
            size={16}
          />
          {discoverLoading ? "Discovering…" : "Run discovery now"}
        </button>
      </div>

      {discoverSummary != null && discoverSummary !== "" && (
        <div className="x-engager-discover-summary" role="status">
          {discoverSummary}
        </div>
      )}

      {error && (
        <p className="x-engager-meta err" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof XE_MAIN_TABS)[number])}
      >
        <TabsList className="x-engager-tabs" aria-label="X Engager main tabs">
          <TabsTrigger className="x-engager-tab x-engager-tab-main" value="replies">
            Replies
          </TabsTrigger>
          <TabsTrigger className="x-engager-tab x-engager-tab-main" value="queries">
            Search queries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="replies">
          <Tabs
            value={repliesSubTab}
            onValueChange={(v) =>
              setRepliesSubTab(v as (typeof XE_REPLIES_SUB_TABS)[number])
            }
          >
            <div className="x-engager-subtabs-wrap">
              <div className="x-engager-subtabs-label">Replies mode</div>
              <TabsList className="x-engager-subtabs" aria-label="Replies mode">
                <TabsTrigger className="x-engager-tab x-engager-tab-sub" value="outbound">
                  Outbound
                </TabsTrigger>
                <TabsTrigger className="x-engager-tab x-engager-tab-sub" value="inbound">
                  Inbound
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="outbound">
              <div className="x-engager-toolbar">
                <select
                  className="x-engager-select"
                  value={statusFilter}
                  onChange={(e) => {
                    setLoading(true);
                    setStatusFilter(e.target.value);
                  }}
                  aria-label="Filter by status"
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="ready">Ready</option>
                  <option value="done">Done</option>
                  <option value="rejected">Rejected</option>
                </select>
                <label className="x-engager-check">
                  <NeuCheckbox
                    id="xe-today-only"
                    checked={todayOnly}
                    onCheckedChange={(on) => {
                      setLoading(true);
                      setTodayOnly(on);
                    }}
                    aria-label="Today only"
                  />
                  Today only
                </label>
                <button
                  type="button"
                  className="xe-btn"
                  onClick={() => {
                    setLoading(true);
                    loadReplies();
                  }}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="xe-btn danger"
                  disabled={clearingDone}
                  onClick={() => clearDoneReplies()}
                >
                  {clearingDone ? "Clearing…" : "Clear replied (done)"}
                </button>
              </div>

              {loading ? (
                <p className="x-engager-empty">Loading…</p>
              ) : replies.length === 0 ? (
                <p className="x-engager-empty">
                  No replies match this filter. Run discovery or adjust filters.
                </p>
              ) : (
                <div className="x-engager-cards">
                  {replies.map((r) => (
                    <ReplyCard
                      key={r.id}
                      reply={r}
                      copiedId={copiedId}
                      onCopy={copyAndFlash}
                      onSaveText={saveReplyText}
                      onStatus={setStatus}
                      onRegenerate={regenerate}
                      onDelete={removeReply}
                      onError={setError}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="inbound">
              <div className="x-engager-toolbar">
                <select
                  className="x-engager-select"
                  value={inboundStatusFilter}
                  onChange={(e) => {
                    setInboundLoading(true);
                    setInboundStatusFilter(e.target.value);
                  }}
                  aria-label="Filter inbound by status"
                >
                  <option value="">All statuses</option>
                  <option value="pending_review">Pending review</option>
                  <option value="approved">Approved</option>
                  <option value="posted">Posted</option>
                  <option value="rejected">Rejected</option>
                  <option value="manual">Manual</option>
                </select>
                <button
                  type="button"
                  className="xe-btn"
                  onClick={() => {
                    setInboundLoading(true);
                    loadInbound();
                  }}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className="xe-btn"
                  disabled={inboundPollingNow}
                  onClick={() => pollInboundNow()}
                >
                  <RefreshCw
                    size={14}
                    className={inboundPollingNow ? "animate-spin" : ""}
                  />
                  {inboundPollingNow ? "Fetching…" : "Fetch inbound now"}
                </button>
                <button
                  type="button"
                  className="xe-btn danger"
                  disabled={clearingInboundPostedManual}
                  onClick={() => clearInboundPostedManual()}
                >
                  {clearingInboundPostedManual
                    ? "Clearing…"
                    : "Clear posted and manual"}
                </button>
                <button
                  type="button"
                  className="xe-btn danger"
                  disabled={clearingInboundAll}
                  onClick={() => clearInboundAll()}
                >
                  {clearingInboundAll ? "Clearing…" : "Clear all"}
                </button>
              </div>
              {inboundMeta?.lastMentionsPollAt && (
                <p className="x-engager-meta" style={{ marginBottom: 12 }}>
                  Last mentions poll:{" "}
                  {new Date(inboundMeta.lastMentionsPollAt).toLocaleString(
                    undefined,
                    { dateStyle: "medium", timeStyle: "short" }
                  )}
                  {inboundMeta.lastMentionsPollError && (
                    <span className="x-engager-meta err" style={{ display: "block" }}>
                      Poll issues: {inboundMeta.lastMentionsPollError}
                    </span>
                  )}
                </p>
              )}
              {!inboundMeta?.lastMentionsPollAt && inboundMeta?.lastMentionsPollError && (
                <p className="x-engager-meta err" style={{ marginBottom: 12 }}>
                  Poll issues: {inboundMeta.lastMentionsPollError}
                </p>
              )}
              <p className="x-engager-meta" style={{ marginBottom: 12, maxWidth: 720 }}>
                New @mentions are fetched on a schedule via{" "}
                <code style={{ fontSize: "0.85em" }}>/api/cron/poll-mentions</code> (OAuth user
                context required). Apply migration{" "}
                <code style={{ fontSize: "0.85em" }}>012_inbound_engager.sql</code> in Supabase.
              </p>
              {inboundLoading ? (
                <p className="x-engager-empty">Loading…</p>
              ) : inboundItems.length === 0 ? (
                <p className="x-engager-empty">
                  No inbound items match this filter. When the poller runs, new mentions appear
                  here with a Grok draft.
                </p>
              ) : (
                <div className="x-engager-cards">
                  {inboundItems.map((row) => (
                    <InboundReplyCard
                      key={row.id}
                      item={row}
                      copiedId={copiedId}
                      onCopy={copyAndFlash}
                      onSaveDraft={saveInboundDraft}
                      onStatus={setInboundStatus}
                      onPost={postInboundReply}
                      onRegenerate={regenerateInbound}
                      onError={setError}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="queries">
          <form className="x-engager-queries-form" onSubmit={submitQuery}>
            <div>
              <label htmlFor="qe-name">Name</label>
              <input
                id="qe-name"
                value={qName}
                onChange={(e) => setQName(e.target.value)}
                placeholder="e.g. AI ethics"
                required
              />
            </div>
            <div className="xe-query-mode-row">
              <label className="xe-query-mode-label">Query</label>
              <label className="xe-qb-toggle xe-query-mode-toggle">
                <NeuCheckbox
                  id="xe-query-builder-mode"
                  checked={builderActive}
                  onCheckedChange={(on) => {
                    if (!on) {
                      setBuilderActive(false);
                      return;
                    }
                    if (!builderActive) {
                      let built = "";
                      try {
                        built = buildQueryStringFromOptions(queryOptions).trim();
                      } catch {
                        built = "";
                      }
                      const raw = qString.trim();
                      if (raw && raw !== built) {
                        const ok = window.confirm(
                          "The raw query no longer matches the structured fields. Switching to the builder will reset fields to defaults and rebuild the query. Copy the raw text first if you need it."
                        );
                        if (!ok) return;
                        setQueryOptions(defaultQueryOptions());
                      }
                      setBuilderActive(true);
                    }
                  }}
                  aria-label="Structured query builder (X API v2 operators)"
                />
                Structured query builder (X API v2 operators)
              </label>
              <p className="xe-query-mode-hint">
                {builderActive
                  ? "Edit fields; the live preview is what discovery runs. Max 512 characters."
                  : "Raw Advanced Search–style string sent to Recent Search. Use the builder for niche anchors and filters, or Generate query from a topic."}
              </p>
            </div>
            {builderActive ? (
              <QueryBuilderPanel
                idPrefix="qe"
                value={queryOptions}
                onChange={setQueryOptions}
                showRecommended
              />
            ) : (
              <div>
                <label htmlFor="qe-q">Query string</label>
                <textarea
                  id="qe-q"
                  value={qString}
                  onChange={(e) => setQString(e.target.value)}
                  placeholder="(AI OR ML) min_faves:10 -is:retweet lang:en"
                  rows={4}
                />
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button type="submit" className="xe-btn primary">
                {editingQuery ? "Save query" : "Add query"}
              </button>
              <button
                type="button"
                className="xe-btn"
                onClick={openScoutModal}
              >
                <Sparkles size={16} aria-hidden />
                Generate query
              </button>
              {editingQuery && (
                <button
                  type="button"
                  className="xe-btn"
                  onClick={() => {
                    setEditingQuery(null);
                    setQName("");
                    setQString("");
                    setQueryOptions(defaultQueryOptions());
                    setBuilderActive(false);
                  }}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>

          <p className="x-engager-meta" style={{ marginTop: 12, maxWidth: 640 }}>
            <strong>Scout:</strong> edit{" "}
            <code style={{ fontSize: "0.85em" }}>prompts/scout-rotation-topics.md</code>{" "}
            for upcoming-weeks focus; suggestions use that file plus recent text saved in
            this app.
          </p>

          {qLoading ? (
            <p className="x-engager-empty">Loading queries…</p>
          ) : queries.length === 0 ? (
            <p className="x-engager-empty">
              No saved queries. Add one above (used by scheduled discovery).
            </p>
          ) : (
            <div className="x-engager-table-wrap">
              <table className="x-engager-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Query</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {queries.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>
                        <code>{previewText(row.query_string, 80)}</code>
                      </td>
                      <td className="xe-query-active-cell">
                        <NeuCheckbox
                          checked={row.is_active}
                          onCheckedChange={() => toggleQueryActive(row)}
                          aria-label={`Active ${row.name}`}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="xe-btn"
                          onClick={() => {
                            setEditingQuery(row);
                            setQName(row.name);
                            const parsed = parseQueryOptions(row.query_options);
                            if (parsed) {
                              setQueryOptions(parsed);
                              setBuilderActive(true);
                              try {
                                setQString(buildQueryStringFromOptions(parsed));
                              } catch {
                                setQString(row.query_string);
                              }
                            } else {
                              setQString(row.query_string);
                              setQueryOptions(defaultQueryOptions());
                              setBuilderActive(false);
                            }
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Edit
                        </button>{" "}
                        <button
                          type="button"
                          className="xe-btn danger"
                          onClick={() => deleteQuery(row.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {generateModalOpen && (
        <div
          className="x-engager-modal-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGenerateModalOpen(false);
          }}
        >
          <div
            className="x-engager-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scout-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="x-engager-modal-head">
              <h2 id="scout-modal-title" className="x-engager-modal-title">
                Generate search query
              </h2>
              <button
                type="button"
                className="xe-btn"
                onClick={() => setGenerateModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="x-engager-modal-tabs">
              <button
                type="button"
                className={`x-engager-modal-tab ${scoutTab === "topic" ? "active" : ""}`}
                onClick={() => {
                  setScoutTab("topic");
                  setScoutError(null);
                }}
              >
                From topic
              </button>
              <button
                type="button"
                className={`x-engager-modal-tab ${scoutTab === "suggest" ? "active" : ""}`}
                onClick={() => {
                  setScoutTab("suggest");
                  setScoutError(null);
                }}
              >
                Suggest topics
              </button>
            </div>

            {scoutTab === "topic" && (
              <div className="x-engager-modal-body">
                <label htmlFor="scout-topic">Topic or seed</label>
                <textarea
                  id="scout-topic"
                  className="x-engager-textarea"
                  value={scoutTopicInput}
                  onChange={(e) => setScoutTopicInput(e.target.value)}
                  placeholder="e.g. remote developers using Cursor, or fashion sustainability"
                  rows={3}
                />
                <button
                  type="button"
                  className="xe-btn primary"
                  disabled={scoutBusy}
                  onClick={() => runScoutFromTopic()}
                >
                  {scoutBusy ? "Generating…" : "Generate"}
                </button>
              </div>
            )}

            {scoutTab === "suggest" && (
              <div className="x-engager-modal-body">
                <p className="x-engager-meta" style={{ marginBottom: 12 }}>
                  Uses Grok with your rotation file and recent posts in this app. Pick a
                  label to generate the X search string.
                </p>
                <button
                  type="button"
                  className="xe-btn primary"
                  disabled={scoutBusy}
                  onClick={() => runScoutSuggest()}
                >
                  {scoutBusy && scoutSuggestions === null
                    ? "Loading…"
                    : "Get topic suggestions"}
                </button>
                {scoutSuggestions != null && scoutSuggestions.length > 0 && (
                  <ul className="x-engager-suggest-list">
                    {scoutSuggestions.map((s, i) => (
                      <li key={`${s.label}-${i}`}>
                        <div className="x-engager-suggest-label">{s.label}</div>
                        {s.rationale && (
                          <div className="x-engager-suggest-rationale">
                            {s.rationale}
                          </div>
                        )}
                        <button
                          type="button"
                          className="xe-btn"
                          disabled={scoutBusy}
                          onClick={() => applyScoutSuggestion(s.label)}
                        >
                          Use → fill form
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {scoutError && (
              <p className="x-engager-meta err x-engager-modal-err">{scoutError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InboundReplyCard({
  item,
  copiedId,
  onCopy,
  onSaveDraft,
  onStatus,
  onPost,
  onRegenerate,
  onError,
}: {
  item: InboundQueueItem;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void | Promise<void>;
  onSaveDraft: (id: string, text: string) => Promise<void>;
  onStatus: (id: string, status: string) => Promise<void>;
  onPost: (id: string, text?: string) => Promise<void>;
  onRegenerate: (id: string) => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const mention = normalizeInboundMention(item.incoming_mentions);
  const ctx = item.original_context as {
    parent_tweet?: { text?: string } | null;
    thread_summary?: string | null;
  };
  const base =
    item.edited_reply != null && item.edited_reply !== ""
      ? item.edited_reply
      : item.grok_suggestion;
  const [text, setText] = React.useState(base);
  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    const next =
      item.edited_reply != null && item.edited_reply !== ""
        ? item.edited_reply
        : item.grok_suggestion;
    setText(next);
  }, [item.edited_reply, item.grok_suggestion, item.id]);

  const serverDraft =
    item.edited_reply != null && item.edited_reply !== ""
      ? item.edited_reply
      : item.grok_suggestion;
  const dirty = text !== serverDraft;

  const mentionUrl = mention
    ? `https://x.com/${mention.author_username}/status/${mention.id}`
    : `https://x.com/i/status/${item.mention_id}`;

  const save = async () => {
    setSaving(true);
    onError(null);
    try {
      await onSaveDraft(item.id, text);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    onError(null);
    try {
      await fn();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const canPost =
    item.status !== "posted" &&
    item.status !== "rejected" &&
    item.status !== "manual";

  return (
    <article className="x-engager-card">
      <div className="x-engager-card-head">
        <p className="x-engager-author">
          {mention ? (
            <a
              href={`https://x.com/${mention.author_username}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              @{mention.author_username}
            </a>
          ) : (
            <span>@{item.mention_id}</span>
          )}
        </p>
        <span className="x-engager-badge">{item.status}</span>
      </div>
      {ctx.parent_tweet?.text && (
        <div className="x-engager-inbound-context">
          <span className="x-engager-label" style={{ display: "block", marginBottom: 4 }}>
            They replied to
          </span>
          {previewText(ctx.parent_tweet.text, 280)}
        </div>
      )}
      {ctx.thread_summary && (
        <div className="x-engager-inbound-context">
          <span className="x-engager-label" style={{ display: "block", marginBottom: 4 }}>
            Thread context
          </span>
          <span style={{ whiteSpace: "pre-wrap" }}>{ctx.thread_summary}</span>
        </div>
      )}
      <p className="x-engager-label">Their mention</p>
      <div className="x-engager-inbound-mention">
        {mention ? previewText(mention.text, 400) : "—"}
      </div>
      <p className="x-engager-label">Your reply (Grok draft)</p>
      <textarea
        className="x-engager-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={280}
        spellCheck
        disabled={item.status === "posted"}
      />
      <div className="x-engager-char">{text.length} / 280</div>
      {item.posted_tweet_id && (
        <p className="x-engager-meta" style={{ marginBottom: 8 }}>
          Posted:{" "}
          <a
            href={`https://x.com/i/status/${item.posted_tweet_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            view your reply
          </a>
        </p>
      )}
      <div className="x-engager-actions">
        <button
          type="button"
          className="xe-btn"
          disabled={!!busy}
          onClick={() =>
            run("open", async () => {
              await onCopy(item.id, text);
              window.open(mentionUrl, "_blank", "noopener,noreferrer");
            })
          }
        >
          <ExternalLink size={14} /> Open mention
        </button>
        <button
          type="button"
          className="xe-btn primary"
          disabled={!!busy}
          onClick={() => onCopy(item.id, text)}
        >
          {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
          {copiedId === item.id ? "Copied" : "Copy reply"}
        </button>
        {dirty && item.status !== "posted" && (
          <button
            type="button"
            className="xe-btn success"
            disabled={saving || !!busy}
            onClick={() => save()}
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
        )}
        <button
          type="button"
          className="xe-btn"
          disabled={!!busy || item.status === "posted"}
          onClick={() => run("regen", () => onRegenerate(item.id))}
        >
          <RefreshCw
            size={14}
            className={busy === "regen" ? "animate-spin" : ""}
          />
          Regenerate
        </button>
        {canPost && (
          <button
            type="button"
            className="xe-btn"
            disabled={!!busy}
            onClick={() => run("approve", () => onStatus(item.id, "approved"))}
          >
            <Bookmark size={14} /> Approve
          </button>
        )}
        {canPost && (
          <button
            type="button"
            className="xe-btn primary"
            disabled={!!busy || !text.trim()}
            onClick={() => run("post", () => onPost(item.id, text))}
          >
            <Send size={14} /> Post reply
          </button>
        )}
        {item.status !== "posted" && (
          <button
            type="button"
            className="xe-btn"
            disabled={!!busy}
            onClick={() => run("manual", () => onStatus(item.id, "manual"))}
          >
            Mark manual
          </button>
        )}
        {item.status !== "posted" && (
          <button
            type="button"
            className="xe-btn danger"
            disabled={!!busy}
            onClick={() => run("reject", () => onStatus(item.id, "rejected"))}
          >
            Reject
          </button>
        )}
      </div>
    </article>
  );
}

function ReplyCard({
  reply: r,
  copiedId,
  onCopy,
  onSaveText,
  onStatus,
  onRegenerate,
  onDelete,
  onError,
}: {
  reply: PendingReply;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void | Promise<void>;
  onSaveText: (id: string, text: string) => Promise<void>;
  onStatus: (id: string, status: string) => Promise<void>;
  onRegenerate: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [text, setText] = React.useState(r.generated_reply);
  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    setText(r.generated_reply);
  }, [r.generated_reply, r.id]);

  const dirty = text !== r.generated_reply;

  const save = async () => {
    setSaving(true);
    onError(null);
    try {
      await onSaveText(r.id, text);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    onError(null);
    try {
      await fn();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="x-engager-card">
      <div className="x-engager-card-head">
        <p className="x-engager-author">
          <a
            href={`https://x.com/${r.author_username}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            @{r.author_username}
          </a>
        </p>
        <span className="x-engager-badge">{r.status}</span>
      </div>
      <p className="x-engager-preview">{previewText(r.original_text)}</p>
      <p className="x-engager-label">Your reply</p>
      <textarea
        className="x-engager-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={280}
        spellCheck
      />
      <div className="x-engager-char">{text.length} / 280</div>
      <div className="x-engager-actions">
        <button
          type="button"
          className="xe-btn"
          disabled={!!busy}
          aria-label="Copy reply to clipboard and open post on X"
          onClick={() =>
            run("open", async () => {
              await onCopy(r.id, text);
              window.open(r.post_url, "_blank", "noopener,noreferrer");
            })
          }
        >
          <ExternalLink size={14} /> Open on X
        </button>
        <button
          type="button"
          className="xe-btn primary"
          disabled={!!busy}
          onClick={() => onCopy(r.id, text)}
        >
          {copiedId === r.id ? <Check size={14} /> : <Copy size={14} />}
          {copiedId === r.id ? "Copied" : "Copy reply"}
        </button>
        {dirty && (
          <button
            type="button"
            className="xe-btn success"
            disabled={saving || !!busy}
            onClick={() => save()}
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
        )}
        <button
          type="button"
          className="xe-btn"
          disabled={!!busy}
          onClick={() => run("regen", () => onRegenerate(r.id))}
        >
          <RefreshCw
            size={14}
            className={busy === "regen" ? "animate-spin" : ""}
          />
          Regenerate
        </button>
        <button
          type="button"
          className="xe-btn"
          disabled={!!busy || r.status === "ready"}
          onClick={() => run("ready", () => onStatus(r.id, "ready"))}
        >
          <Bookmark size={14} /> Ready
        </button>
        <button
          type="button"
          className="xe-btn success"
          disabled={!!busy}
          onClick={() => run("done", () => onStatus(r.id, "done"))}
        >
          <CircleCheck size={14} /> Done
        </button>
        <button
          type="button"
          className="xe-btn danger"
          disabled={!!busy}
          onClick={() => run("del", () => onDelete(r.id))}
        >
          <Trash2 size={14} /> Remove
        </button>
      </div>
    </article>
  );
}
