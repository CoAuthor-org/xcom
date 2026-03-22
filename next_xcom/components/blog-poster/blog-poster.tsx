"use client";

import * as React from "react";
import { Github, LogOut } from "lucide-react";
import "./blog-poster.css";

const ADDITIONAL_TWEAKS_KEY = "blog-poster-additional-tweaks";

interface GitHubOrg {
  login: string;
  id: number;
}

interface GitHubPR {
  title: string;
  number: number;
  html_url: string;
  repository: { full_name: string };
}

export function BlogPoster() {
  const [notesFiles, setNotesFiles] = React.useState<string[]>([]);
  const [selectedNote, setSelectedNote] = React.useState("");

  const [githubStatus, setGithubStatus] = React.useState<{
    configured: boolean;
    connected: boolean;
    user: { login: string } | null;
  } | null>(null);
  const [orgs, setOrgs] = React.useState<GitHubOrg[]>([]);
  const [prs, setPrs] = React.useState<GitHubPR[]>([]);
  const [selectedOrg, setSelectedOrg] = React.useState("");
  const [selectedPr, setSelectedPr] = React.useState("");
  const [orgsLoading, setOrgsLoading] = React.useState(false);
  const [prsLoading, setPrsLoading] = React.useState(false);
  const [additionalTweaks, setAdditionalTweaks] = React.useState("");

  const loadNotesFiles = React.useCallback(async () => {
    try {
      const res = await fetch("/notes/files");
      const data = await res.json();
      setNotesFiles(data.files || []);
    } catch {
      setNotesFiles([]);
    }
  }, []);

  const loadGithubStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/github/status");
      const data = await res.json();
      setGithubStatus(data);
    } catch {
      setGithubStatus({ configured: false, connected: false, user: null });
    }
  }, []);

  const loadOrgs = React.useCallback(async () => {
    setOrgsLoading(true);
    try {
      const res = await fetch("/api/github/orgs");
      const data = await res.json();
      if (res.ok) {
        setOrgs(data.orgs || []);
        setSelectedOrg("");
        setPrs([]);
        setSelectedPr("");
      } else {
        setOrgs([]);
      }
    } catch {
      setOrgs([]);
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  const loadPrs = React.useCallback(async (org: string) => {
    if (!org) {
      setPrs([]);
      setSelectedPr("");
      return;
    }
    setPrsLoading(true);
    try {
      const res = await fetch(`/api/github/prs?org=${encodeURIComponent(org)}`);
      const data = await res.json();
      if (res.ok) {
        setPrs(data.prs || []);
        setSelectedPr("");
      } else {
        setPrs([]);
      }
    } catch {
      setPrs([]);
    } finally {
      setPrsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadNotesFiles();
    loadGithubStatus();
  }, [loadNotesFiles, loadGithubStatus]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setAdditionalTweaks(localStorage.getItem(ADDITIONAL_TWEAKS_KEY) ?? "");
    }
  }, []);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ADDITIONAL_TWEAKS_KEY, additionalTweaks);
    }
  }, [additionalTweaks]);

  React.useEffect(() => {
    if (githubStatus?.connected) {
      loadOrgs();
    } else {
      setOrgs([]);
      setPrs([]);
    }
  }, [githubStatus?.connected, loadOrgs]);

  React.useEffect(() => {
    if (selectedOrg) {
      loadPrs(selectedOrg);
    } else {
      setPrs([]);
      setSelectedPr("");
    }
  }, [selectedOrg, loadPrs]);

  const handleLogout = async () => {
    await fetch("/api/github/logout", { method: "POST" });
    setGithubStatus((s) => (s ? { ...s, connected: false, user: null } : null));
    setOrgs([]);
    setPrs([]);
    setSelectedOrg("");
    setSelectedPr("");
  };

  return (
    <div className="blog-poster">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Notes selector */}
        <div className="blog-poster-card">
          <label className="blog-poster-label">Notes</label>
          <select
            value={selectedNote}
            onChange={(e) => setSelectedNote(e.target.value)}
            className="blog-poster-select"
          >
            <option value="">Select a note file...</option>
            {notesFiles.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* GitHub section */}
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
              <a
                href="/api/github/auth"
                className="blog-poster-connect-btn"
              >
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
            <div className="space-y-4">
              <div>
                <label className="blog-poster-label">
                  Organization
                </label>
                <select
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  className="blog-poster-select"
                  disabled={orgsLoading}
                >
                  <option value="">Select an organization...</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.login}>
                      {o.login}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="blog-poster-label">
                  Pull requests ({selectedOrg || "select org"})
                </label>
                <select
                  value={selectedPr}
                  onChange={(e) => setSelectedPr(e.target.value)}
                  className="blog-poster-select"
                  disabled={!selectedOrg || prsLoading}
                >
                  <option value="">
                    {!selectedOrg
                      ? "Select an organization first"
                      : prsLoading
                        ? "Loading..."
                        : "Select a PR..."}
                  </option>
                  {prs.map((pr) => (
                    <option key={pr.html_url} value={pr.html_url}>
                      #{pr.number} — {pr.title} ({pr.repository.full_name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Additional tweaks */}
        <div className="blog-poster-card">
          <label className="blog-poster-label">Additional tweaks</label>
          <textarea
            value={additionalTweaks}
            onChange={(e) => setAdditionalTweaks(e.target.value)}
            placeholder="Paste any additional context or tweaks here..."
            rows={8}
            className="blog-poster-textarea"
          />
        </div>
      </div>
    </div>
  );
}
