"use client";

import * as React from "react";
import type { ScouterOsRepo } from "@/lib/scouter/types";

export function OpenSourceTerminal() {
  const [items, setItems] = React.useState<ScouterOsRepo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scouter/os-repos?limit=200");
      const data = (await res.json().catch(() => ({}))) as {
        items?: ScouterOsRepo[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const runScan = async () => {
    setBusyId("scan");
    setError(null);
    try {
      const res = await fetch("/api/scouter/cron/github");
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const initRepo = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/scouter/os-repos/${id}/initialize`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="scouter-panel">
      <div className="scouter-panel-head">
        <div>
          <h3 className="scouter-panel-title">Open Source Terminal</h3>
          <p className="scouter-panel-sub">
            Discover repos with actionable issues and community links.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="sc-btn primary" onClick={runScan} disabled={!!busyId}>
            {busyId === "scan" ? "Scanning..." : "Scan GitHub"}
          </button>
          <button type="button" className="sc-btn" onClick={() => load()} disabled={!!busyId}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="sc-empty">{error}</div>}

      {loading ? (
        <div className="sc-empty">Loading repositories...</div>
      ) : items.length === 0 ? (
        <div className="sc-empty">No repositories yet. Run GitHub scan to populate.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 10,
          }}
        >
          {items.map((item) => (
            <article key={item.id} className="sc-table-wrap" style={{ padding: 12 }}>
              <h4 style={{ margin: 0, fontSize: "0.9rem" }}>{item.repo_name}</h4>
              <p style={{ color: "#6b6b6b", margin: "8px 0", fontSize: "0.78rem" }}>
                {item.issue_title}
              </p>
              <p style={{ margin: "8px 0", fontSize: "0.75rem" }}>
                <strong>Language:</strong> {item.language}
              </p>
              <p style={{ margin: "8px 0", fontSize: "0.75rem" }}>
                <strong>Status:</strong> {item.status}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <a href={item.url} target="_blank" rel="noreferrer" className="sc-btn">
                  Repo
                </a>
                {item.community_link && (
                  <a
                    href={item.community_link}
                    target="_blank"
                    rel="noreferrer"
                    className="sc-btn"
                  >
                    Community
                  </a>
                )}
                <button
                  type="button"
                  className="sc-btn success"
                  disabled={busyId === item.id}
                  onClick={() => initRepo(item.id)}
                >
                  {busyId === item.id ? "Initializing..." : "Initialize Local Agent"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
