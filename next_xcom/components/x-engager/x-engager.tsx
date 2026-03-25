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
} from "lucide-react";
import "./x-engager.css";

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
}

function previewText(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function XEngager() {
  const [tab, setTab] = React.useState<"replies" | "queries">("replies");
  const [replies, setReplies] = React.useState<PendingReply[]>([]);
  const [meta, setMeta] = React.useState<RepliesMeta | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [todayOnly, setTodayOnly] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [discoverLoading, setDiscoverLoading] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const [queries, setQueries] = React.useState<SearchQueryRow[]>([]);
  const [qLoading, setQLoading] = React.useState(true);
  const [qName, setQName] = React.useState("");
  const [qString, setQString] = React.useState("");
  const [editingQuery, setEditingQuery] = React.useState<SearchQueryRow | null>(
    null
  );

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

  const runDiscover = async () => {
    setDiscoverLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discover-posts?batch=manual", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || res.statusText
        );
      }
      await loadReplies();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDiscoverLoading(false);
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

  const submitQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qName.trim() || !qString.trim()) return;
    if (editingQuery) {
      const res = await fetch(`/api/queries/${editingQuery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: qName.trim(),
          query_string: qString.trim(),
        }),
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
        body: JSON.stringify({
          name: qName.trim(),
          query_string: qString.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as { error?: string }).error || "Failed");
        return;
      }
    }
    setQName("");
    setQString("");
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

      {error && (
        <p className="x-engager-meta err" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}

      <div className="x-engager-tabs">
        <button
          type="button"
          className={`x-engager-tab ${tab === "replies" ? "active" : ""}`}
          onClick={() => setTab("replies")}
        >
          Replies
        </button>
        <button
          type="button"
          className={`x-engager-tab ${tab === "queries" ? "active" : ""}`}
          onClick={() => setTab("queries")}
        >
          Search queries
        </button>
      </div>

      {tab === "replies" && (
        <>
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
              <input
                type="checkbox"
                checked={todayOnly}
                onChange={(e) => {
                  setLoading(true);
                  setTodayOnly(e.target.checked);
                }}
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
        </>
      )}

      {tab === "queries" && (
        <>
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
            <div>
              <label htmlFor="qe-q">Query string</label>
              <textarea
                id="qe-q"
                value={qString}
                onChange={(e) => setQString(e.target.value)}
                placeholder="(AI OR ML) min_faves:10 -is:retweet lang:en"
                required
              />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" className="xe-btn primary">
                {editingQuery ? "Save query" : "Add query"}
              </button>
              {editingQuery && (
                <button
                  type="button"
                  className="xe-btn"
                  onClick={() => {
                    setEditingQuery(null);
                    setQName("");
                    setQString("");
                  }}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>

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
                      <td>
                        <input
                          type="checkbox"
                          checked={row.is_active}
                          onChange={() => toggleQueryActive(row)}
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
                            setQString(row.query_string);
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
        </>
      )}
    </div>
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
  onCopy: (id: string, text: string) => void;
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
          onClick={() =>
            window.open(r.post_url, "_blank", "noopener,noreferrer")
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
