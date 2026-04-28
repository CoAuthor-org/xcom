"use client";

import * as React from "react";
import { Building2, Github, Loader2, LogOut, Plus, RefreshCw, Save, X } from "lucide-react";
import { NeuCheckbox } from "@/components/ui/neu-checkbox";
import { useAppSync } from "@/lib/app-sync";
import {
  createCompanyAction,
  fetchCompanyRepos,
  listCompaniesAction,
  syncReposToSupabase,
} from "@/actions/github-actions";
import type { CompanyRow } from "@/lib/crm/types";
import "./blog-poster.css";

interface GitHubRepoItem {
  full_name: string;
  name: string;
  owner: string;
  private: boolean;
  default_branch: string | null;
}

interface TrackedRepoItem {
  id: string;
  full_name: string;
  branch_filter: string | null;
}

interface CommitDraft {
  id: string;
  repo_full_name: string;
  commit_sha: string;
  commit_message: string | null;
  diff_excerpt: string | null;
  generated_text: string;
  status: "pending" | "approved" | "rejected" | "published";
  created_at: string;
}

interface CompanyFormState {
  name: string;
  category: string;
  github_org_url: string;
  website_url: string;
}

export function Opensource() {
  const [githubStatus, setGithubStatus] = React.useState<{
    configured: boolean;
    connected: boolean;
    user: { login: string } | null;
  } | null>(null);

  const [origin, setOrigin] = React.useState("");
  const [repos, setRepos] = React.useState<GitHubRepoItem[]>([]);
  const [reposLoading, setReposLoading] = React.useState(false);
  const [trackedSelection, setTrackedSelection] = React.useState<Set<string>>(
    () => new Set()
  );
  const [trackedLoading, setTrackedLoading] = React.useState(false);
  const [saveTrackingLoading, setSaveTrackingLoading] = React.useState(false);
  const [blogDbError, setBlogDbError] = React.useState<string | null>(null);

  const [drafts, setDrafts] = React.useState<CommitDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = React.useState(false);
  const [draftEdits, setDraftEdits] = React.useState<Record<string, string>>({});
  const [companies, setCompanies] = React.useState<CompanyRow[]>([]);
  const [companiesLoading, setCompaniesLoading] = React.useState(false);
  const [companiesError, setCompaniesError] = React.useState<string | null>(null);
  const [syncingCompanyId, setSyncingCompanyId] = React.useState<string | null>(null);
  const [syncMessageByCompany, setSyncMessageByCompany] = React.useState<Record<string, string>>(
    {}
  );
  const [isAddCompanyOpen, setIsAddCompanyOpen] = React.useState(false);
  const [creatingCompany, setCreatingCompany] = React.useState(false);
  const [companyForm, setCompanyForm] = React.useState<CompanyFormState>({
    name: "",
    category: "",
    github_org_url: "",
    website_url: "",
  });

  const loadGithubStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/github/status");
      const data = await res.json();
      setGithubStatus(data);
    } catch {
      setGithubStatus({ configured: false, connected: false, user: null });
    }
  }, []);

  const loadReposAndTracking = React.useCallback(async () => {
    setReposLoading(true);
    setTrackedLoading(true);
    setBlogDbError(null);
    try {
      const [rRes, tRes] = await Promise.all([
        fetch("/api/github/repos"),
        fetch("/api/github/tracked-repos"),
      ]);
      if (rRes.ok) {
        const rData = await rRes.json();
        setRepos(rData.repos || []);
      } else {
        setRepos([]);
      }
      if (tRes.status === 503) {
        setBlogDbError(
          "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, run migration 011, then reconnect GitHub."
        );
        setTrackedSelection(new Set());
      } else if (tRes.ok) {
        const tData = await tRes.json();
        const names = (tData.tracked as TrackedRepoItem[] | undefined)?.map(
          (x) => x.full_name
        ) ?? [];
        setTrackedSelection(new Set(names));
      } else {
        setTrackedSelection(new Set());
      }
    } catch {
      setRepos([]);
      setBlogDbError("Failed to load GitHub data.");
    } finally {
      setReposLoading(false);
      setTrackedLoading(false);
    }
  }, []);

  const loadDrafts = React.useCallback(async () => {
    setDraftsLoading(true);
    try {
      const res = await fetch("/api/blog/drafts?limit=40");
      if (!res.ok) {
        setDrafts([]);
        return;
      }
      const data = await res.json();
      const list = (data.drafts || []) as CommitDraft[];
      setDrafts(list);
      setDraftEdits((prev) => {
        const next = { ...prev };
        for (const d of list) {
          if (next[d.id] === undefined) next[d.id] = d.generated_text;
        }
        return next;
      });
    } catch {
      setDrafts([]);
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  const loadCompanies = React.useCallback(async () => {
    setCompaniesLoading(true);
    setCompaniesError(null);
    try {
      const rows = await listCompaniesAction();
      setCompanies(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load companies";
      setCompaniesError(message);
      setCompanies([]);
    } finally {
      setCompaniesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadGithubStatus();
    void loadCompanies();
  }, [loadGithubStatus, loadCompanies]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  React.useEffect(() => {
    if (githubStatus?.connected) {
      loadReposAndTracking();
      loadDrafts();
    } else {
      setRepos([]);
      setTrackedSelection(new Set());
      setDrafts([]);
      setBlogDbError(null);
    }
  }, [githubStatus?.connected, loadReposAndTracking, loadDrafts]);

  useAppSync(() => {
    void loadGithubStatus();
    if (githubStatus?.connected) {
      void loadReposAndTracking();
      void loadDrafts();
    }
    void loadCompanies();
  });

  const toggleTracked = (fullName: string) => {
    setTrackedSelection((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  };

  const saveTracking = async () => {
    setSaveTrackingLoading(true);
    try {
      const res = await fetch("/api/github/tracked-repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracked: [...trackedSelection] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setBlogDbError(typeof err.error === "string" ? err.error : "Save failed");
        return;
      }
      setBlogDbError(null);
      await loadReposAndTracking();
    } finally {
      setSaveTrackingLoading(false);
    }
  };

  const patchDraft = async (
    id: string,
    patch: Partial<Pick<CommitDraft, "generated_text" | "status">>
  ) => {
    const res = await fetch(`/api/blog/drafts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const data = await res.json();
    const d = data.draft as CommitDraft | undefined;
    if (d) {
      setDrafts((prev) => prev.map((x) => (x.id === d.id ? d : x)));
      setDraftEdits((prev) => ({ ...prev, [d.id]: d.generated_text }));
    }
  };

  const handleLogout = async () => {
    await fetch("/api/github/logout", { method: "POST" });
    setGithubStatus((s) => (s ? { ...s, connected: false, user: null } : null));
    setRepos([]);
    setTrackedSelection(new Set());
    setDrafts([]);
    setBlogDbError(null);
  };

  const handleCreateCompany = async () => {
    setCreatingCompany(true);
    setCompaniesError(null);
    try {
      const created = await createCompanyAction({
        name: companyForm.name,
        category: companyForm.category || null,
        github_org_url: companyForm.github_org_url || null,
        website_url: companyForm.website_url || null,
      });
      setCompanies((prev) => [created, ...prev]);
      setCompanyForm({
        name: "",
        category: "",
        github_org_url: "",
        website_url: "",
      });
      setIsAddCompanyOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create company";
      setCompaniesError(message);
    } finally {
      setCreatingCompany(false);
    }
  };

  const handleSyncCompanyRepos = async (company: CompanyRow) => {
    console.info("[opensource] syncRepos:click", {
      companyId: company.id,
      companyName: company.name,
      githubOrgUrl: company.github_org_url,
    });
    if (!company.github_org_url?.trim()) {
      console.warn("[opensource] syncRepos:missing-org", {
        companyId: company.id,
        companyName: company.name,
      });
      setSyncMessageByCompany((prev) => ({
        ...prev,
        [company.id]: "Add a GitHub org URL or org name for this company first.",
      }));
      return;
    }
    setSyncingCompanyId(company.id);
    setSyncMessageByCompany((prev) => ({
      ...prev,
      [company.id]: "Syncing repositories...",
    }));
    try {
      const { repos } = await fetchCompanyRepos(company.github_org_url);
      console.info("[opensource] syncRepos:fetched-from-github", {
        companyId: company.id,
        repoCount: repos.length,
      });
      const { syncedCount } = await syncReposToSupabase(company.id, repos);
      console.info("[opensource] syncRepos:upserted-to-supabase", {
        companyId: company.id,
        syncedCount,
      });
      setSyncMessageByCompany((prev) => ({
        ...prev,
        [company.id]: `Synced ${syncedCount} repositories`,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Repository sync failed";
      console.error("[opensource] syncRepos:error", {
        companyId: company.id,
        message,
        error,
      });
      setSyncMessageByCompany((prev) => ({
        ...prev,
        [company.id]: message,
      }));
    } finally {
      setSyncingCompanyId(null);
    }
  };

  const webhookUrl = origin ? `${origin}/api/webhooks/github` : "/api/webhooks/github";

  return (
    <div className="blog-poster">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="blog-poster-card">
          <div className="mb-4 flex items-center justify-between">
            <label className="blog-poster-label mb-0">GitHub</label>
            {githubStatus?.connected ? (
              <div className="flex items-center gap-2">
                <span className="blog-poster-user-badge">
                  @{githubStatus.user?.login}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="blog-poster-disconnect-btn"
                  title="Disconnect GitHub"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              </div>
            ) : (
              <a href="/api/github/auth" className="blog-poster-connect-btn">
                <Github className="h-4 w-4" />
                Connect GitHub
              </a>
            )}
          </div>

          {!githubStatus?.configured && (
            <p className="blog-poster-warning">
              Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to .env to enable.
            </p>
          )}

          {githubStatus?.connected && (
            <div className="space-y-5">
              {blogDbError && (
                <p className="blog-poster-warning">{blogDbError}</p>
              )}

              <div className="blog-poster-webhook-box">
                <p className="blog-poster-webhook-title">Commit webhooks (manual setup)</p>
                <p className="blog-poster-webhook-help">
                  In each tracked repository: Settings → Webhooks → Add webhook. Content type{" "}
                  <code>application/json</code>. Enable <strong>push</strong> events. Use the same
                  secret as <code>GITHUB_WEBHOOK_SECRET</code> in your server{" "}
                  <code>.env</code>. Pushes to <code>main</code> or <code>master</code> are
                  processed (or your per-repo branch filter when we add it in the DB).
                </p>
                <label className="blog-poster-label">Payload URL</label>
                <code className="blog-poster-code-block">{webhookUrl}</code>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="blog-poster-label mb-0">
                    Repos to track ({trackedSelection.size} selected)
                  </label>
                  {(reposLoading || trackedLoading) && (
                    <span className="blog-poster-muted">Loading…</span>
                  )}
                </div>
                <div className="blog-poster-repo-scroller neo-inset">
                  {repos.length === 0 && !reposLoading ? (
                    <p className="blog-poster-muted p-3">No repositories loaded.</p>
                  ) : (
                    repos.map((r) => (
                      <label key={r.full_name} className="blog-poster-repo-row">
                        <NeuCheckbox
                          id={`blog-repo-${r.full_name.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
                          checked={trackedSelection.has(r.full_name)}
                          onCheckedChange={() => toggleTracked(r.full_name)}
                          aria-label={`Track ${r.full_name}`}
                        />
                        <span className="blog-poster-repo-name">{r.full_name}</span>
                        {r.private && (
                          <span className="blog-poster-repo-badge">private</span>
                        )}
                      </label>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  className="blog-poster-primary-btn mt-3"
                  disabled={saveTrackingLoading || !!blogDbError}
                  onClick={saveTracking}
                >
                  <Save className="h-4 w-4" />
                  {saveTrackingLoading ? "Saving…" : "Save tracked repos"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="blog-poster-card">
          <div className="mb-4 flex items-center justify-between">
            <label className="blog-poster-label mb-0 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              CRM Companies
            </label>
            <button
              type="button"
              className="blog-poster-primary-btn"
              onClick={() => setIsAddCompanyOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Company
            </button>
          </div>

          {companiesError && <p className="blog-poster-warning mb-3">{companiesError}</p>}
          {!githubStatus?.connected && (
            <p className="blog-poster-muted mb-3">
              Connect GitHub to enable repository sync for companies.
            </p>
          )}

          <div className="blog-poster-repo-scroller neo-inset">
            {companiesLoading ? (
              <p className="blog-poster-muted p-3">Loading companies...</p>
            ) : companies.length === 0 ? (
              <p className="blog-poster-muted p-3">No companies yet. Add your first company.</p>
            ) : (
              companies.map((company) => {
                const isSyncing = syncingCompanyId === company.id;
                return (
                  <div key={company.id} className="blog-poster-company-row">
                    <div className="min-w-0">
                      <p className="blog-poster-company-name">{company.name}</p>
                      <p className="blog-poster-company-meta">
                        {company.category || "Uncategorized"}
                        {company.github_org_url ? ` • ${company.github_org_url}` : ""}
                      </p>
                      {syncMessageByCompany[company.id] && (
                        <p className="blog-poster-company-status">
                          {syncMessageByCompany[company.id]}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="blog-poster-secondary-btn"
                      onClick={() => handleSyncCompanyRepos(company)}
                      disabled={!githubStatus?.connected || isSyncing}
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        "Sync Repos"
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {githubStatus?.connected && !blogDbError && (
          <div className="blog-poster-card">
            <div className="mb-3 flex items-center justify-between">
              <label className="blog-poster-label mb-0">Tweet drafts from commits</label>
              <button
                type="button"
                className="blog-poster-icon-btn"
                onClick={loadDrafts}
                disabled={draftsLoading}
                title="Refresh drafts"
              >
                <RefreshCw className={draftsLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </button>
            </div>
            {draftsLoading && drafts.length === 0 ? (
              <p className="blog-poster-muted">Loading drafts…</p>
            ) : drafts.length === 0 ? (
              <p className="blog-poster-muted">
                No drafts yet. After you push to a tracked repo, drafts appear here.
              </p>
            ) : (
              <ul className="blog-poster-draft-list space-y-4">
                {drafts.map((d) => (
                  <li key={d.id} className="blog-poster-draft-card">
                    <div className="blog-poster-draft-meta">
                      <span className="blog-poster-draft-repo">{d.repo_full_name}</span>
                      <code className="blog-poster-draft-sha">
                        {d.commit_sha.slice(0, 7)}
                      </code>
                      <span className={`blog-poster-status blog-poster-status-${d.status}`}>
                        {d.status}
                      </span>
                    </div>
                    {d.commit_message && (
                      <p className="blog-poster-commit-msg">
                        {d.commit_message.split("\n")[0]}
                      </p>
                    )}
                    <textarea
                      className="blog-poster-textarea blog-poster-draft-textarea"
                      rows={4}
                      value={draftEdits[d.id] ?? d.generated_text}
                      onChange={(e) =>
                        setDraftEdits((prev) => ({ ...prev, [d.id]: e.target.value }))
                      }
                    />
                    <div className="blog-poster-draft-actions">
                      <button
                        type="button"
                        className="blog-poster-secondary-btn"
                        onClick={() =>
                          patchDraft(d.id, {
                            generated_text: draftEdits[d.id] ?? d.generated_text,
                          })
                        }
                      >
                        Save text
                      </button>
                      <button
                        type="button"
                        className="blog-poster-secondary-btn"
                        onClick={() => patchDraft(d.id, { status: "approved" })}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="blog-poster-secondary-btn"
                        onClick={() => patchDraft(d.id, { status: "rejected" })}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="blog-poster-secondary-btn"
                        onClick={() => patchDraft(d.id, { status: "pending" })}
                      >
                        Pending
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      </div>

      {isAddCompanyOpen && (
        <div className="blog-poster-modal-backdrop">
          <div className="blog-poster-modal-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="blog-poster-modal-title">Add company</h3>
              <button
                type="button"
                className="blog-poster-icon-btn"
                onClick={() => setIsAddCompanyOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="blog-poster-label">Name *</label>
                <input
                  className="blog-poster-select"
                  value={companyForm.name}
                  onChange={(event) =>
                    setCompanyForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Acme Labs"
                />
              </div>
              <div>
                <label className="blog-poster-label">Category</label>
                <input
                  className="blog-poster-select"
                  value={companyForm.category}
                  onChange={(event) =>
                    setCompanyForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                  placeholder="YC / Silicon Valley / GSoC"
                />
              </div>
              <div>
                <label className="blog-poster-label">GitHub org URL or name</label>
                <input
                  className="blog-poster-select"
                  value={companyForm.github_org_url}
                  onChange={(event) =>
                    setCompanyForm((prev) => ({ ...prev, github_org_url: event.target.value }))
                  }
                  placeholder="https://github.com/vercel or vercel"
                />
              </div>
              <div>
                <label className="blog-poster-label">Website URL</label>
                <input
                  className="blog-poster-select"
                  value={companyForm.website_url}
                  onChange={(event) =>
                    setCompanyForm((prev) => ({ ...prev, website_url: event.target.value }))
                  }
                  placeholder="https://example.com"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="blog-poster-secondary-btn"
                  onClick={() => setIsAddCompanyOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="blog-poster-primary-btn"
                  onClick={handleCreateCompany}
                  disabled={creatingCompany || !companyForm.name.trim()}
                >
                  {creatingCompany ? "Creating..." : "Create company"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
