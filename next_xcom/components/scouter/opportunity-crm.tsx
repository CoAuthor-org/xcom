"use client";

import * as React from "react";
import type { ScouterOpportunity } from "@/lib/scouter/types";

export function OpportunityCrm() {
  const [items, setItems] = React.useState<ScouterOpportunity[]>([]);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadItems = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/scouter/opportunities?limit=150");
      const data = (await res.json().catch(() => ({}))) as {
        items?: ScouterOpportunity[];
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
    loadItems();
  }, [loadItems]);

  const runLeadCron = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/scouter/cron/leads");
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      await loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: ScouterOpportunity["status"]) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scouter/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        item?: ScouterOpportunity;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || res.statusText);
      if (data.item) setItems((prev) => prev.map((p) => (p.id === id ? data.item! : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/scouter/opportunities/export");
      if (!res.ok) throw new Error("CSV export failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "scouter-opportunity-domains.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scouter-panel">
      <div className="scouter-panel-head">
        <div>
          <h3 className="scouter-panel-title">Opportunity CRM</h3>
          <p className="scouter-panel-sub">
            Scored remote agency opportunities and outreach workflow.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="sc-btn primary" disabled={busy} onClick={runLeadCron}>
            {busy ? "Running..." : "Fetch + Score Leads"}
          </button>
          <button type="button" className="sc-btn" disabled={busy} onClick={exportCsv}>
            Export Domains (CSV)
          </button>
          <button type="button" className="sc-btn" onClick={() => loadItems()}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="sc-empty">{error}</div>}

      {loading ? (
        <div className="sc-empty">Loading opportunities...</div>
      ) : items.length === 0 ? (
        <div className="sc-empty">No opportunities yet. Run lead discovery to populate CRM.</div>
      ) : (
        <div className="sc-table-wrap">
          <table className="sc-table">
            <thead>
              <tr>
                <th>Score</th>
                <th>Company</th>
                <th>Domain</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <React.Fragment key={item.id}>
                  <tr>
                    <td>{item.match_score}</td>
                    <td>{item.company_name}</td>
                    <td>{item.domain}</td>
                    <td>
                      <select
                        className="sc-select"
                        value={item.status}
                        onChange={(e) =>
                          setStatus(item.id, e.target.value as ScouterOpportunity["status"])
                        }
                        style={{ maxWidth: 120, padding: "4px 8px", fontSize: "0.75rem" }}
                      >
                        <option value="new">new</option>
                        <option value="contacted">contacted</option>
                        <option value="ignored">ignored</option>
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="sc-btn"
                        onClick={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                      >
                        {expandedId === item.id ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr>
                      <td colSpan={5}>
                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ color: "#6b6b6b", fontSize: "0.78rem" }}>
                            {item.description}
                          </div>
                          <textarea
                            className="sc-textarea"
                            readOnly
                            value={item.outreach_draft}
                            style={{ minHeight: 140 }}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
