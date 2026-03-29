"use client";

import * as React from "react";
import type { ScouterContentDraft, ScouterKnowledge } from "@/lib/scouter/types";
import { NightWatcherInput } from "@/components/scouter/night-watcher-input";

export function KnowledgeFeed() {
  const [items, setItems] = React.useState<ScouterKnowledge[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<ScouterContentDraft[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [draftsLoading, setDraftsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selected = React.useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const loadKnowledge = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/scouter/knowledge?limit=80");
      const data = (await res.json().catch(() => ({}))) as {
        items?: ScouterKnowledge[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || res.statusText);
      const rows = data.items ?? [];
      setItems(rows);
      setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDrafts = React.useCallback(async (knowledgeId: string) => {
    setDraftsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scouter/knowledge/${knowledgeId}/drafts`);
      const data = (await res.json().catch(() => ({}))) as {
        drafts?: ScouterContentDraft[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setDrafts(data.drafts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  React.useEffect(() => {
    if (!selectedId) {
      setDrafts([]);
      return;
    }
    loadDrafts(selectedId);
  }, [selectedId, loadDrafts]);

  const updateDraft = async (
    id: string,
    patch: Partial<Pick<ScouterContentDraft, "draft_text" | "status">>
  ) => {
    const res = await fetch(`/api/scouter/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json().catch(() => ({}))) as {
      draft?: ScouterContentDraft;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || res.statusText);
    setDrafts((prev) => prev.map((d) => (d.id === id && data.draft ? data.draft : d)));
  };

  return (
    <div className="scouter-panel">
      <div className="scouter-panel-head">
        <div>
          <h3 className="scouter-panel-title">Knowledge Feed</h3>
          <p className="scouter-panel-sub">
            Incoming email, RSS, YouTube, and social knowledge with generated drafts.
          </p>
        </div>
        <button type="button" className="sc-btn" onClick={() => loadKnowledge()}>
          Refresh
        </button>
      </div>

      {error && <p className="sc-empty">{error}</p>}

      <NightWatcherInput />

      <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 12 }}>
        <aside className="sc-table-wrap" style={{ maxHeight: "68vh", overflowY: "auto" }}>
          {loading ? (
            <div className="sc-empty">Loading knowledge...</div>
          ) : items.length === 0 ? (
            <div className="sc-empty">No knowledge yet. Send an email webhook to begin.</div>
          ) : (
            <div>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: 10,
                    border: "none",
                    borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
                    background: selectedId === item.id ? "rgba(0, 0, 0, 0.04)" : "transparent",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "0.84rem", fontWeight: 600 }}>{item.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "#6b6b6b", marginTop: 4 }}>
                    {item.source_type} · {new Date(item.created_at).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section>
          {!selected ? (
            <div className="sc-empty">Select a knowledge item to inspect drafts.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <article className="sc-table-wrap" style={{ padding: 10 }}>
                <h4 style={{ margin: 0 }}>{selected.title}</h4>
                <p style={{ marginTop: 8, color: "#6b6b6b", fontSize: "0.85rem" }}>
                  {selected.summary}
                </p>
              </article>

              {draftsLoading ? (
                <div className="sc-empty">Loading drafts...</div>
              ) : drafts.length === 0 ? (
                <div className="sc-empty">No drafts linked to this knowledge item.</div>
              ) : (
                drafts.map((draft) => (
                  <DraftEditorCard
                    key={draft.id}
                    draft={draft}
                    onSave={async (text) => updateDraft(draft.id, { draft_text: text })}
                    onStatus={async (status) => updateDraft(draft.id, { status })}
                  />
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DraftEditorCard({
  draft,
  onSave,
  onStatus,
}: {
  draft: ScouterContentDraft;
  onSave: (text: string) => Promise<void>;
  onStatus: (status: ScouterContentDraft["status"]) => Promise<void>;
}) {
  const [text, setText] = React.useState(draft.draft_text);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setText(draft.draft_text);
  }, [draft.draft_text, draft.id]);

  const dirty = text !== draft.draft_text;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="sc-table-wrap" style={{ padding: 12 }}>
      <div className="scouter-panel-head">
        <div>
          <h4 style={{ margin: 0, fontSize: "0.9rem", textTransform: "capitalize" }}>
            {draft.platform} Draft
          </h4>
          <p className="scouter-panel-sub">Status: {draft.status}</p>
        </div>
      </div>
      <textarea
        className="sc-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        {dirty && (
          <button
            type="button"
            className="sc-btn primary"
            disabled={busy}
            onClick={() => run(() => onSave(text))}
          >
            Save
          </button>
        )}
        <button
          type="button"
          className="sc-btn success"
          disabled={busy}
          onClick={() => run(() => onStatus("approved"))}
        >
          Approve
        </button>
        <button
          type="button"
          className="sc-btn danger"
          disabled={busy}
          onClick={() => run(() => onStatus("discarded"))}
        >
          Discard
        </button>
      </div>
    </article>
  );
}
