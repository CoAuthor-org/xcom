"use client";

import * as React from "react";
import { BookOpenText, BriefcaseBusiness, Blocks, Settings2 } from "lucide-react";
import { KnowledgeFeed } from "@/components/scouter/knowledge-feed";
import { OpportunityCrm } from "@/components/scouter/opportunity-crm";
import { OpenSourceTerminal } from "@/components/scouter/open-source-terminal";
import { ScouterSettings } from "@/components/scouter/scouter-settings";
import "./scouter.css";

type ScouterTab = "knowledge" | "opportunities" | "openSource" | "settings";

interface MetricsPayload {
  pendingDrafts: number;
  highValueLeads: number;
  pendingRepos: number;
}

const TABS: Array<{ id: ScouterTab; label: string; icon: React.ElementType }> = [
  { id: "knowledge", label: "Knowledge Feed", icon: BookOpenText },
  { id: "opportunities", label: "Opportunity CRM", icon: BriefcaseBusiness },
  { id: "openSource", label: "Open Source Terminal", icon: Blocks },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export function ScouterDashboard() {
  const [activeTab, setActiveTab] = React.useState<ScouterTab>("knowledge");
  const [metrics, setMetrics] = React.useState<MetricsPayload>({
    pendingDrafts: 0,
    highValueLeads: 0,
    pendingRepos: 0,
  });

  React.useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const res = await fetch("/api/scouter/metrics");
        if (!res.ok) return;
        const data = (await res.json()) as Partial<MetricsPayload>;
        if (!alive) return;
        setMetrics({
          pendingDrafts: Number(data.pendingDrafts ?? 0),
          highValueLeads: Number(data.highValueLeads ?? 0),
          pendingRepos: Number(data.pendingRepos ?? 0),
        });
      } catch {
        // Dashboard can still render with zeroed metrics.
      }
    };
    run();
    const interval = window.setInterval(run, 15000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="scouter">
      <div className="scouter-hud">
        <MetricCard label="Pending Content Drafts" value={metrics.pendingDrafts} />
        <MetricCard label="New High-Value Leads (>8 Score)" value={metrics.highValueLeads} />
        <MetricCard label="Pending OS Repos" value={metrics.pendingRepos} />
      </div>

      <div className="scouter-main">
        <aside className="scouter-sidebar">
          <h2 className="scouter-sidebar-title">Scouter</h2>
          <p className="scouter-sidebar-sub">Agency and knowledge operating system.</p>
          <div className="scouter-tab-list">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`scouter-tab-btn ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </aside>

        <section className="scouter-canvas">
          {activeTab === "knowledge" && <KnowledgeFeed />}
          {activeTab === "opportunities" && <OpportunityCrm />}
          {activeTab === "openSource" && <OpenSourceTerminal />}
          {activeTab === "settings" && <ScouterSettings />}
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="scouter-metric-card">
      <p className="scouter-metric-label">{label}</p>
      <p className="scouter-metric-value">{value}</p>
    </article>
  );
}
