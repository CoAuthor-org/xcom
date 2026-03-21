"use client";

import * as React from "react";
import { Github, LogOut } from "lucide-react";

const selectClass =
  "w-full rounded-lg border-2 border-[#38444d] bg-[#15202b] px-4 py-3 text-[#e7e9ea] outline-none transition-colors focus:border-[#1d9bf0]";

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
    <div className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Notes selector */}
        <div className="rounded-2xl border border-[#38444d] bg-[#192734] p-6">
          <label className="mb-2 block text-sm font-medium text-[#8899a6]">
            Notes
          </label>
          <select
            value={selectedNote}
            onChange={(e) => setSelectedNote(e.target.value)}
            className={selectClass}
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
        <div className="rounded-2xl border border-[#38444d] bg-[#192734] p-6">
          <div className="mb-4 flex items-center justify-between">
            <label className="text-sm font-medium text-[#8899a6]">
              GitHub
            </label>
            {githubStatus?.connected ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#00ba7c]">
                  @{githubStatus.user?.login}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#8899a6] hover:bg-[#22303c] hover:text-[#e7e9ea]"
                  title="Disconnect GitHub"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              </div>
            ) : (
              <a
                href="/api/github/auth"
                className="inline-flex items-center gap-2 rounded-lg bg-[#238636] px-4 py-2 text-sm font-medium text-white hover:bg-[#2ea043]"
              >
                <Github className="h-4 w-4" />
                Connect GitHub
              </a>
            )}
          </div>

          {!githubStatus?.configured && (
            <p className="mb-4 text-sm text-[#f0883e]">
              Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to .env to enable.
            </p>
          )}

          {githubStatus?.connected && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-[#8b98a5]">
                  Organization
                </label>
                <select
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  className={selectClass}
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
                <label className="mb-2 block text-xs font-medium text-[#8b98a5]">
                  Pull requests ({selectedOrg || "select org"})
                </label>
                <select
                  value={selectedPr}
                  onChange={(e) => setSelectedPr(e.target.value)}
                  className={selectClass}
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
      </div>
    </div>
  );
}
