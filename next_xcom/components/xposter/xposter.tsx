"use client";

import * as React from "react";
import "./xposter.css";

const SERVER_UNREACHABLE_MSG =
  "Server not reachable. Run \"npm start\" and open http://localhost:3000";

interface Entry {
  id: string;
  text: string;
  timestamp?: string;
  topicRef?: string;
  part?: number;
  imageUrl?: string;
  postedAt?: string;
  queue?: string;
  threadId?: string;
  threadIndex?: number;
  pollOptions?: string[];
  pollDurationMinutes?: number;
}

type RagTweet = string | { text: string; topicRef?: string; part?: number };

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp?: string): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function XPoster() {
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [message, setMessage] = React.useState<{ text: string; type: string }>({ text: "", type: "" });
  const [llmEnabled, setLlmEnabled] = React.useState(false);
  const [notesFiles, setNotesFiles] = React.useState<string[]>([]);
  const [selectedNote, setSelectedNote] = React.useState("");
  const [postsCount, setPostsCount] = React.useState(10);
  const [lastRagTweets, setLastRagTweets] = React.useState<RagTweet[]>([]);
  const [notesLog, setNotesLog] = React.useState<
    { msg: string; kind: string; time: string }[]
  >([]);
  const [isThread, setIsThread] = React.useState(false);
  const [threadLength, setThreadLength] = React.useState(4);
  const [isPoll, setIsPoll] = React.useState(false);
  const [notesLoading, setNotesLoading] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState("");
  const [dequeueLoading, setDequeueLoading] = React.useState(false);
  const [deletePostedLoading, setDeletePostedLoading] = React.useState(false);
  const [selectedActionLoading, setSelectedActionLoading] = React.useState(false);
  const [queueFilter, setQueueFilter] = React.useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = React.useState<Set<string>>(new Set());
  const [postedFilter, setPostedFilter] = React.useState(false);
  const [selectedUnits, setSelectedUnits] = React.useState<Set<string>>(new Set());

  const showMessage = React.useCallback((text: string, type: string) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  }, []);

  const loadEntries = React.useCallback(async () => {
    try {
      const res = await fetch("/entries");
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      console.error("Failed to load entries:", e);
    }
  }, []);

  const loadNotesFiles = React.useCallback(async () => {
    try {
      const res = await fetch("/notes/files");
      const data = await res.json();
      const files = data.files || [];
      setNotesFiles(files);
    } catch {
      setNotesFiles([]);
    }
  }, []);

  const checkLLMStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/llm/status");
      const data = await res.json();
      setLlmEnabled(!!data.initialized);
    } catch {
      setLlmEnabled(false);
    }
  }, []);

  React.useEffect(() => {
    loadEntries();
    checkLLMStatus();
    loadNotesFiles();
  }, [loadEntries, checkLLMStatus, loadNotesFiles]);

  const appendLog = React.useCallback((msg: string, kind: string) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setNotesLog((prev) => [...prev, { msg, kind, time }]);
  }, []);

  const handleDequeueAll = async () => {
    setDequeueLoading(true);
    try {
      const res = await fetch("/entries/queue", { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showMessage(data.message || "Dequeued all", "success");
        loadEntries();
      } else {
        showMessage(data.error || "Failed to dequeue all", "error");
      }
    } catch {
      showMessage(SERVER_UNREACHABLE_MSG, "error");
    } finally {
      setDequeueLoading(false);
    }
  };

  const getSelectedEntryIds = React.useCallback((): string[] => {
    const byT: Record<string, Entry[]> = {};
    for (const e of entries) {
      if (e.threadId) {
        if (!byT[e.threadId]) byT[e.threadId] = [];
        byT[e.threadId].push(e);
      }
    }
    const ids: string[] = [];
    for (const unitId of selectedUnits) {
      if (byT[unitId]?.length > 1) {
        byT[unitId].forEach((x) => ids.push(x.id));
      } else {
        ids.push(unitId);
      }
    }
    return ids;
  }, [entries, selectedUnits]);

  const handleDequeueSelected = async () => {
    const entryIds = getSelectedEntryIds();
    if (entryIds.length === 0) return;
    setSelectedActionLoading(true);
    try {
      let ok = 0;
      let err = 0;
      for (const id of entryIds) {
        const res = await fetch(`/entries/${id}/queue`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queue: null }),
        });
        if (res.ok) ok++;
        else err++;
      }
      if (err === 0) {
        showMessage(`Dequeued ${ok} post${ok !== 1 ? "s" : ""}`, "success");
        setSelectedUnits(new Set());
        loadEntries();
      } else {
        showMessage(`Failed to dequeue some posts (${err} failed)`, "error");
        loadEntries();
      }
    } catch {
      showMessage(SERVER_UNREACHABLE_MSG, "error");
    } finally {
      setSelectedActionLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    const entryIds = getSelectedEntryIds();
    if (entryIds.length === 0) return;
    if (
      !confirm(
        `Delete ${entryIds.length} selected post${entryIds.length !== 1 ? "s" : ""}? This cannot be undone.`
      )
    )
      return;
    setSelectedActionLoading(true);
    try {
      let ok = 0;
      let err = 0;
      for (const id of entryIds) {
        const res = await fetch(`/entries/${id}`, { method: "DELETE" });
        if (res.ok) ok++;
        else err++;
      }
      if (err === 0) {
        showMessage(`Deleted ${ok} post${ok !== 1 ? "s" : ""}`, "success");
        setSelectedUnits(new Set());
        loadEntries();
      } else {
        showMessage(`Failed to delete some posts (${err} failed)`, "error");
        loadEntries();
      }
    } catch {
      showMessage(SERVER_UNREACHABLE_MSG, "error");
    } finally {
      setSelectedActionLoading(false);
    }
  };

  const handleClearSelections = () => setSelectedUnits(new Set());

  const handleBulkSchedule = async (queue: "8am" | "12pm" | "4pm" | "8pm") => {
    const entryIds = getSelectedEntryIds();
    if (entryIds.length === 0) return;
    setSelectedActionLoading(true);
    try {
      let ok = 0;
      let err = 0;
      for (const id of entryIds) {
        const res = await fetch(`/entries/${id}/queue`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queue }),
        });
        if (res.ok) ok++;
        else err++;
      }
      if (err === 0) {
        showMessage(`Scheduled ${ok} post${ok !== 1 ? "s" : ""} for ${queue}`, "success");
        setSelectedUnits(new Set());
        loadEntries();
      } else {
        showMessage(`Failed to schedule some posts (${err} failed)`, "error");
        loadEntries();
      }
    } catch {
      showMessage(SERVER_UNREACHABLE_MSG, "error");
    } finally {
      setSelectedActionLoading(false);
    }
  };

  const handleDeletePosted = async () => {
    if (
      !confirm(
        "Delete all entries that are already posted to X? Drafts and queued (unposted) entries stay."
      )
    )
      return;
    setDeletePostedLoading(true);
    try {
      const res = await fetch("/entries/bulk/posted", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showMessage(data.message || "Done", "success");
        loadEntries();
      } else {
        showMessage(data.error || "Delete posted failed", "error");
      }
    } catch {
      showMessage(SERVER_UNREACHABLE_MSG, "error");
    } finally {
      setDeletePostedLoading(false);
    }
  };

  const lastLogIndexRef = React.useRef(0);

  const handleGenerateFromNotes = async () => {
    if (!selectedNote || !llmEnabled) return;
    setNotesLoading(true);
    setLastRagTweets([]);
    setNotesLog([]);
    lastLogIndexRef.current = 0;
    appendLog(`Starting job for: ${selectedNote}`, "msg");
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    try {
      const count = Math.min(50, Math.max(1, postsCount));
      const body: Record<string, unknown> = {
        file: selectedNote,
        postsCount: count,
      };
      if (isThread) {
        body.isThread = true;
        body.threadLength = threadLength;
      }
      if (isPoll) body.isPoll = true;

      const startRes = await fetch("/generate-from-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok) {
        appendLog("Request failed: " + (startData.error || startRes.status), "err");
        setNotesLoading(false);
        showMessage(startData.error || "Generation failed", "error");
        return;
      }
      const jobId = startData.jobId;
      if (!jobId) {
        appendLog("No job started (file may have no segments)", "err");
        setNotesLoading(false);
        return;
      }
      appendLog("Job started. Polling for progress...", "msg");

      const poll = async () => {
        try {
          const statusRes = await fetch(
            `/generate-from-notes/status/${jobId}`
          );
          const job = await statusRes.json().catch(() => ({}));
          const logs = job.logs || [];
          for (let i = lastLogIndexRef.current; i < logs.length; i++) {
            appendLog(logs[i].msg, logs[i].kind || "msg");
          }
          lastLogIndexRef.current = logs.length;
          if (job.status === "done") {
            if (pollInterval) clearInterval(pollInterval);
            setLastRagTweets(job.tweets || []);
            const saved =
              job.savedCount != null
                ? job.savedCount
                : (job.tweets || []).length;
            showMessage(
              job.tweets?.length
                ? `Generated and saved ${saved} tweet(s)`
                : "No new tweets from this run.",
              "success"
            );
            loadEntries();
            setNotesLoading(false);
          } else if (job.status === "error") {
            if (pollInterval) clearInterval(pollInterval);
            setLastRagTweets([]);
            showMessage(job.error || "Generation failed", "error");
            setNotesLoading(false);
          }
        } catch (e) {
          if (pollInterval) clearInterval(pollInterval);
          appendLog("Poll failed: " + (e as Error).message, "err");
          showMessage(SERVER_UNREACHABLE_MSG, "error");
          setNotesLoading(false);
        }
      };
      pollInterval = setInterval(poll, 1500);
      await poll();
    } catch (e) {
      appendLog("Failed: " + (e as Error).message, "err");
      setNotesLog([]);
      showMessage(SERVER_UNREACHABLE_MSG, "error");
      setNotesLoading(false);
    }
  };

  const handleResetPointer = async () => {
    if (!selectedNote) return;
    try {
      const res = await fetch("/notes/progress/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: selectedNote }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showMessage(
          data.message || `Pointer reset for ${selectedNote}. Next run will start from the top.`,
          "success"
        );
      } else {
        showMessage(data.error || "Reset failed", "error");
      }
    } catch {
      showMessage(SERVER_UNREACHABLE_MSG, "error");
    }
  };

  const handleCopyAllRag = async () => {
    if (lastRagTweets.length === 0) return;
    const lines = lastRagTweets
      .map((t) => (typeof t === "string" ? t : t.text).trim())
      .filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showMessage(
        `Copied ${lines.length} post(s). Paste into Excel or Google Sheets (one per row).`,
        "success"
      );
    } catch {
      showMessage("Copy failed", "error");
    }
  };

  const handleDeleteAllEntries = async () => {
    if (!confirm("Delete all saved posts? This cannot be undone.")) return;
    try {
      const res = await fetch("/entries/all", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showMessage("All posts deleted", "success");
        loadEntries();
        setLastRagTweets([]);
      } else {
        showMessage(data.error || "Delete failed", "error");
      }
    } catch {
      showMessage(SERVER_UNREACHABLE_MSG, "error");
    }
  };

  const saveRagTweet = async (t: string) => {
    try {
      const res = await fetch("/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t.substring(0, 280) }),
      });
      if (res.ok) {
        showMessage("Saved to list!", "success");
        loadEntries();
      } else {
        const data = await res.json().catch(() => ({}));
        showMessage(data.error || "Save failed", "error");
      }
    } catch {
      showMessage("Save failed", "error");
    }
  };

  const byThreadFull: Record<string, Entry[]> = {};
  for (const e of entries) {
    const tid = e.threadId ?? null;
    if (tid) {
      if (!byThreadFull[tid]) byThreadFull[tid] = [];
      byThreadFull[tid].push(e);
    }
  }
  for (const tid of Object.keys(byThreadFull)) {
    byThreadFull[tid].sort((a, b) => (a.threadIndex ?? 0) - (b.threadIndex ?? 0));
  }

  type EntryType = "thread" | "poll" | "single";
  const getEntryType = (e: Entry): EntryType => {
    if ((e.pollOptions?.length ?? 0) > 0) return "poll";
    if (e.threadId && (byThreadFull[e.threadId]?.length ?? 0) > 1) return "thread";
    return "single";
  };

  const countingUnits: { queue: string }[] = [];
  const countedThreadIds = new Set<string>();
  for (const e of entries) {
    if (e.threadId && byThreadFull[e.threadId]?.length > 1) {
      if (!countedThreadIds.has(e.threadId)) {
        countedThreadIds.add(e.threadId);
        const firstInThread = byThreadFull[e.threadId][0];
        countingUnits.push({ queue: firstInThread?.queue || "" });
      }
    } else {
      countingUnits.push({ queue: e.queue || "" });
    }
  }

  const count8am = countingUnits.filter((u) => u.queue === "8am").length;
  const count12pm = countingUnits.filter((u) => u.queue === "12pm").length;
  const count4pm = countingUnits.filter((u) => u.queue === "4pm").length;
  const count8pm = countingUnits.filter((u) => u.queue === "8pm").length;
  const countUnscheduled = countingUnits.filter((u) => !u.queue.trim()).length;
  const countPosted = entries.filter((e) => e.postedAt).length;
  const countThreads = Object.keys(byThreadFull).filter(
    (tid) => byThreadFull[tid].length > 1
  ).length;
  const countPolls = entries.filter((e) => getEntryType(e) === "poll").length;
  const countSingle = entries.filter((e) => getEntryType(e) === "single").length;

  const queueMatches = (e: Entry) =>
    queueFilter.size === 0 ||
    (queueFilter.has("unscheduled") && !(e.queue || "").trim()) ||
    (!!(e.queue || "").trim() && queueFilter.has(e.queue || ""));
  const typeMatches = (e: Entry) =>
    typeFilter.size === 0 || typeFilter.has(getEntryType(e));
  const postedMatches = (e: Entry) =>
    !postedFilter || !!e.postedAt;

  const filteredEntries = entries.filter(
    (e) => queueMatches(e) && typeMatches(e) && postedMatches(e)
  );

  const toggleQueueFilter = (queue: string) => {
    setQueueFilter((prev) => {
      const next = new Set(prev);
      if (next.has(queue)) next.delete(queue);
      else next.add(queue);
      return next;
    });
  };
  const toggleTypeFilter = (type: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };
  const togglePostedFilter = () => setPostedFilter((p) => !p);

  const getSelectUnitId = (entry: Entry, threadPos?: { index: number; total: number }) =>
    threadPos && threadPos.index === 1 && entry.threadId ? entry.threadId : entry.id;
  const isSelectable = (entry: Entry, threadPos?: { index: number; total: number }) =>
    !threadPos || threadPos.index === 1;
  const isUnitSelected = (unitId: string) => selectedUnits.has(unitId);
  const toggleSelectUnit = (unitId: string) => {
    setSelectedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const byThread: Record<string, Entry[]> = {};
  const standalone: Entry[] = [];
  for (const e of filteredEntries) {
    const tid = e.threadId ?? null;
    if (tid) {
      if (!byThread[tid]) byThread[tid] = [];
      byThread[tid].push(e);
    } else {
      standalone.push(e);
    }
  }
  for (const tid of Object.keys(byThread)) {
    byThread[tid].sort((a, b) => (a.threadIndex ?? 0) - (b.threadIndex ?? 0));
  }
  type GroupItem =
    | { type: "thread"; id: string; entries: Entry[] }
    | { type: "standalone"; id: string; entries: Entry[] };
  const groupOrder: GroupItem[] = [];
  for (const tid of Object.keys(byThread)) {
    groupOrder.push({ type: "thread", id: tid, entries: byThread[tid] });
  }
  for (const e of standalone) {
    groupOrder.push({ type: "standalone", id: e.id, entries: [e] });
  }
  groupOrder.sort((a, b) => {
    const aTime = a.entries[0]?.timestamp ?? "";
    const bTime = b.entries[0]?.timestamp ?? "";
    return bTime.localeCompare(aTime);
  });

  const setQueue = async (entryId: string, newQueue: string | null) => {
    try {
      const res = await fetch(`/entries/${entryId}/queue`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue: newQueue }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showMessage(newQueue ? `Queue: ${newQueue}` : "Removed from queue", "success");
        loadEntries();
      } else {
        showMessage(data.error || "Failed to set queue", "error");
      }
    } catch {
      showMessage(SERVER_UNREACHABLE_MSG, "error");
    }
  };

  const uploadImage = async (entryId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      showMessage("Please drop an image file (JPEG, PNG, etc.)", "error");
      return;
    }
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch(`/entries/${entryId}/image`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showMessage("Image attached", "success");
        loadEntries();
      } else {
        showMessage(data.error || "Upload failed", "error");
      }
    } catch {
      showMessage(SERVER_UNREACHABLE_MSG, "error");
    }
  };

  const removeImage = async (entryId: string) => {
    if (!confirm("Remove the attached image?")) return;
    try {
      const res = await fetch(`/entries/${entryId}/image`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showMessage("Image removed", "success");
        loadEntries();
      } else {
        showMessage(data.error || "Remove failed", "error");
      }
    } catch {
      showMessage(SERVER_UNREACHABLE_MSG, "error");
    }
  };

  const saveEdit = async (entryId: string) => {
    const t = editText.trim();
    if (!t || t.length > 280) {
      showMessage("Text must be 1–280 characters", "error");
      return;
    }
    try {
      const res = await fetch(`/entries/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (res.ok) {
        showMessage("Updated", "success");
        setEditingId(null);
        loadEntries();
      } else {
        const data = await res.json();
        showMessage(data.error || "Update failed", "error");
      }
    } catch {
      showMessage(SERVER_UNREACHABLE_MSG, "error");
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!confirm("Delete this entry?")) return;
    try {
      const res = await fetch(`/entries/${entryId}`, { method: "DELETE" });
      if (res.ok) {
        showMessage("Deleted", "success");
        loadEntries();
      } else {
        const data = await res.json();
        showMessage(data.error || "Delete failed", "error");
      }
    } catch {
      showMessage(SERVER_UNREACHABLE_MSG, "error");
    }
  };

  const renderEntryCard = (
    entry: Entry,
    threadPos?: { index: number; total: number }
  ) => {
    const isEditing = editingId === entry.id;
    const topicLabel =
      entry.topicRef && entry.part
        ? `<span class="entry-topic-ref">${escapeHtml(entry.topicRef)} (${entry.part}/2)</span>`
        : "";
    const threadBadge = threadPos
      ? `<span class="thread-post-badge">Post ${threadPos.index}/${threadPos.total}</span>`
      : "";
    const pollBadge =
      entry.pollOptions && entry.pollOptions.length >= 2
        ? '<span class="poll-badge">Poll</span>'
        : "";
    const pollOptionsHtml =
      entry.pollOptions && entry.pollOptions.length >= 2
        ? `<div class="entry-poll-options">Options: <ul>${entry.pollOptions.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul></div>`
        : "";
    const imageHtml = entry.imageUrl
      ? `<img class="entry-image" src="${escapeHtml(entry.imageUrl)}" alt="Attached" loading="lazy">`
      : "";
    const postedBadge = entry.postedAt
      ? `<span class="entry-posted-badge" title="Posted ${escapeHtml(formatDate(entry.postedAt))}">Posted</span>`
      : "";
    const cardClass = entry.postedAt ? " entry-card--posted" : "";

    if (isEditing) {
      return (
        <div
          key={entry.id}
          className={`entry-card${cardClass}`}
          data-entry-id={entry.id}
        >
          <div className="entry-view hidden">
            {/* placeholder for structure */}
          </div>
          <div className="entry-edit visible">
            <textarea
              maxLength={280}
              className="entry-edit-input"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
            <div className="edit-actions">
              <button
                type="button"
                className="xp-btn save-edit-btn"
                onClick={() => saveEdit(entry.id)}
              >
                Save
              </button>
              <button
                type="button"
                className="xp-btn cancel-edit-btn"
                onClick={() => {
                  setEditingId(null);
                  setEditText("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    const unitId = getSelectUnitId(entry, threadPos);
    const selectable = isSelectable(entry, threadPos);
    const selected =
      threadPos && entry.threadId
        ? isUnitSelected(entry.threadId)
        : isUnitSelected(entry.id);
    const effectiveCardClass = `${cardClass}${selected ? " selected" : ""}`;

    return (
      <EntryCard
        key={entry.id}
        entry={entry}
        threadPos={threadPos}
        topicLabel={topicLabel}
        threadBadge={threadBadge}
        pollBadge={pollBadge}
        pollOptionsHtml={pollOptionsHtml}
        imageHtml={imageHtml}
        postedBadge={postedBadge}
        cardClass={effectiveCardClass}
        selectable={selectable}
        selected={selected}
        onToggleSelect={() => toggleSelectUnit(unitId)}
        onCopy={(txt) => {
          navigator.clipboard.writeText(txt).then(() => {
            showMessage("Copied!", "success");
          });
        }}
        onEdit={() => {
          setEditingId(entry.id);
          setEditText(entry.text);
        }}
        queue={entry.queue || ""}
        onSetQueue={setQueue}
        onUploadImage={uploadImage}
        onRemoveImage={removeImage}
        onDelete={deleteEntry}
      />
    );
  };

  return (
    <div className="xposter">
      <div className="xp-app">
        <div className="xp-panel">
          <h1 className="xp-panel-header">Notes → Tweets</h1>
          <div className="input-section">
            {message.text && (
              <div className={`message ${message.type}`}>{message.text}</div>
            )}
            <div className="notes-section">
              <label className="notes-label">Select note and generate</label>
              <div className="notes-row">
                <select
                  value={selectedNote}
                  onChange={(e) => setSelectedNote(e.target.value)}
                  className="notes-select"
                >
                  <option value="">Select a note file...</option>
                  {notesFiles.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <label className="notes-count-label" htmlFor="postsCountInput">
                  Posts:
                </label>
                <input
                  id="postsCountInput"
                  type="number"
                  min={1}
                  max={50}
                  value={postsCount}
                  onChange={(e) => setPostsCount(parseInt(e.target.value, 10) || 10)}
                  className="posts-count-input"
                  title="Number of posts to generate (1 LLM run per post)"
                />
                <button
                  type="button"
                  className={`xp-btn generate-from-notes-btn ${notesLoading ? "loading" : ""}`}
                  onClick={handleGenerateFromNotes}
                  disabled={!llmEnabled || notesFiles.length === 0}
                >
                  <span className="btn-text">From notes</span>
                  <span className="spinner" />
                </button>
                <button
                  type="button"
                  className="reset-pointer-btn"
                  onClick={handleResetPointer}
                  disabled={!selectedNote}
                  title="Reset pointer to top of this document. Next run will start from the beginning."
                >
                  Reset pointer
                </button>
              </div>
              <div className="is-thread-row">
                <label className="is-thread-toggle">
                  <input
                    type="checkbox"
                    checked={isThread}
                    onChange={(e) => {
                      setIsThread(e.target.checked);
                      if (e.target.checked) setIsPoll(false);
                    }}
                  />
                  <span>Is thread</span>
                </label>
              </div>
              {isThread && (
                <div className="thread-length-row">
                  <label htmlFor="threadLengthSelect">Thread length:</label>
                  <select
                    id="threadLengthSelect"
                    className="thread-length-select"
                    value={threadLength}
                    onChange={(e) => setThreadLength(parseInt(e.target.value, 10))}
                  >
                    <option value={2}>2 posts</option>
                    <option value={3}>3 posts</option>
                    <option value={4}>4 posts</option>
                    <option value={5}>5 posts</option>
                    <option value={6}>6 posts</option>
                  </select>
                </div>
              )}
              <div className="is-poll-row">
                <label className="is-poll-toggle">
                  <input
                    type="checkbox"
                    checked={isPoll}
                    onChange={(e) => {
                      setIsPoll(e.target.checked);
                      if (e.target.checked) setIsThread(false);
                    }}
                  />
                  <span>Is poll</span>
                </label>
              </div>
              <div className="notes-log-header">
                <span>Live log</span>
                <button
                  type="button"
                  className="notes-log-clear"
                  onClick={() => setNotesLog([])}
                >
                  Clear
                </button>
              </div>
              <div className="notes-log-terminal">
                {notesLog.length === 0 ? (
                  <span style={{ color: "#484f58" }}>
                    Logs will appear here when you run &quot;From notes&quot;...
                  </span>
                ) : (
                  notesLog.map((line, i) => (
                    <div key={i} className={`log-line ${line.kind}`}>
                      [{line.time}] {line.msg}
                    </div>
                  ))
                )}
              </div>
              <div className="rag-actions-row">
                <button
                  type="button"
                  className="rag-action-btn copy-all-btn"
                  onClick={handleCopyAllRag}
                  disabled={lastRagTweets.length === 0}
                  title="Copy all generated posts (one per line, paste into Excel/Sheets)"
                >
                  Copy all
                </button>
                <button
                  type="button"
                  className="rag-action-btn delete-all-btn"
                  onClick={handleDeleteAllEntries}
                  title="Delete all saved posts and clear the list"
                >
                  Delete all
                </button>
              </div>
              <div className="rag-results">
                {lastRagTweets.length === 0 ? (
                  <div className="rag-empty">
                    No tweets generated. Add .md files to the notes folder and try again.
                  </div>
                ) : (
                  lastRagTweets.map((t, i) => {
                    const text = typeof t === "string" ? t : t.text;
                    const topicLabel =
                      typeof t !== "string" && t.topicRef && t.part
                        ? `${t.topicRef} (${t.part}/2)`
                        : "";
                    return (
                      <div key={i} className="rag-tweet-card">
                        {topicLabel && (
                          <span className="rag-topic-ref">{topicLabel}</span>
                        )}
                        <span className="text">{text}</span>
                        <div className="actions">
                          <button
                            type="button"
                            className="mini-copy-btn"
                            onClick={async () => {
                              await navigator.clipboard.writeText(text);
                              showMessage("Copied!", "success");
                            }}
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            className="mini-save-btn"
                            onClick={() => saveRagTweet(text)}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="xp-panel">
          <div className="xp-panel-header">
            <div className="xp-panel-title-row">
              <h1 className="xp-panel-title">Saved Texts</h1>
              <span className="entries-count">
              ({filteredEntries.length}
              {(queueFilter.size > 0 || typeFilter.size > 0 || postedFilter) && ` of ${entries.length}`})
              </span>
            </div>
            <div className="xp-panel-filters">
              <button
                type="button"
                className={`queue-filter-btn q-8am ${queueFilter.has("8am") ? "active" : ""}`}
                onClick={() => toggleQueueFilter("8am")}
                title="Filter: 8am queue"
              >
                8am: {count8am}
              </button>
              <button
                type="button"
                className={`queue-filter-btn q-12pm ${queueFilter.has("12pm") ? "active" : ""}`}
                onClick={() => toggleQueueFilter("12pm")}
                title="Filter: 12pm queue"
              >
                12pm: {count12pm}
              </button>
              <button
                type="button"
                className={`queue-filter-btn q-4pm ${queueFilter.has("4pm") ? "active" : ""}`}
                onClick={() => toggleQueueFilter("4pm")}
                title="Filter: 4pm queue"
              >
                4pm: {count4pm}
              </button>
              <button
                type="button"
                className={`queue-filter-btn q-8pm ${queueFilter.has("8pm") ? "active" : ""}`}
                onClick={() => toggleQueueFilter("8pm")}
                title="Filter: 8pm queue"
              >
                8pm: {count8pm}
              </button>
              <button
                type="button"
                className={`queue-filter-btn q-unscheduled ${queueFilter.has("unscheduled") ? "active" : ""}`}
                onClick={() => toggleQueueFilter("unscheduled")}
                title="Filter: posts not assigned to any queue"
              >
                Unscheduled: {countUnscheduled}
              </button>
              <button
                type="button"
                className={`queue-filter-btn q-posted ${postedFilter ? "active" : ""}`}
                onClick={togglePostedFilter}
                title="Filter: posts already posted to X"
              >
                Posted: {countPosted}
              </button>
              <button
                type="button"
                className={`type-filter-btn ${typeFilter.has("thread") ? "active" : ""}`}
                onClick={() => toggleTypeFilter("thread")}
                title="Filter: threads only"
              >
                Threads: {countThreads}
              </button>
              <button
                type="button"
                className={`type-filter-btn ${typeFilter.has("poll") ? "active" : ""}`}
                onClick={() => toggleTypeFilter("poll")}
                title="Filter: polls only"
              >
                Polls: {countPolls}
              </button>
              <button
                type="button"
                className={`type-filter-btn ${typeFilter.has("single") ? "active" : ""}`}
                onClick={() => toggleTypeFilter("single")}
                title="Filter: single posts only"
              >
                Single: {countSingle}
              </button>
            </div>
            <div className="xp-panel-actions">
              {selectedUnits.size > 0 ? (
                <>
                  <span className="selected-count-badge">{selectedUnits.size} selected</span>
                  <button
                    type="button"
                    className="bulk-queue-btn q-8am"
                    onClick={() => handleBulkSchedule("8am")}
                    disabled={selectedActionLoading}
                    title="Schedule selected for 8am"
                  >
                    8am
                  </button>
                  <button
                    type="button"
                    className="bulk-queue-btn q-12pm"
                    onClick={() => handleBulkSchedule("12pm")}
                    disabled={selectedActionLoading}
                    title="Schedule selected for 12pm"
                  >
                    12pm
                  </button>
                  <button
                    type="button"
                    className="bulk-queue-btn q-4pm"
                    onClick={() => handleBulkSchedule("4pm")}
                    disabled={selectedActionLoading}
                    title="Schedule selected for 4pm"
                  >
                    4pm
                  </button>
                  <button
                    type="button"
                    className="bulk-queue-btn q-8pm"
                    onClick={() => handleBulkSchedule("8pm")}
                    disabled={selectedActionLoading}
                    title="Schedule selected for 8pm"
                  >
                    8pm
                  </button>
                  <button
                    type="button"
                    className="dequeue-all-btn"
                    onClick={handleDequeueSelected}
                    disabled={selectedActionLoading}
                    title="Remove selected from their queues"
                  >
                    Dequeue Selected
                  </button>
                  <button
                    type="button"
                    className="dequeue-all-btn delete-posted-btn"
                    onClick={handleDeleteSelected}
                    disabled={selectedActionLoading}
                    title="Delete selected posts"
                  >
                    Delete Selected
                  </button>
                  <button
                    type="button"
                    className="clear-selections-btn"
                    onClick={handleClearSelections}
                    disabled={selectedActionLoading}
                    title="Deselect all"
                  >
                    Clear Selections
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="dequeue-all-btn"
                    onClick={handleDequeueAll}
                    disabled={dequeueLoading}
                    title="Remove all posts from 8am, 12pm, 4pm and 8pm queues"
                  >
                    Dequeue All
                  </button>
                  <button
                    type="button"
                    className="dequeue-all-btn delete-posted-btn"
                    onClick={handleDeletePosted}
                    disabled={deletePostedLoading}
                    title="Remove only entries already posted to X (unposted stay)"
                  >
                    Delete posted
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="entries-list">
            {filteredEntries.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <p>
                  {entries.length === 0
                    ? "No saved texts yet. Start by composing one!"
                    : "No posts match the selected filters. Click queue, type or Posted buttons above to change filters."}
                </p>
              </div>
            ) : (
              groupOrder.map((group) => {
                if (group.type === "thread" && group.entries.length > 1) {
                  const q = group.entries[0]?.queue || "";
                  const threadSelected = selectedUnits.has(group.id);
                  return (
                    <div
                      key={group.id}
                      className={`thread-container${threadSelected ? " selected" : ""}`}
                    >
                      <div className="thread-header">
                        Thread ({group.entries.length} posts)
                        {q ? ` · ${q}` : ""}
                      </div>
                      <div className="thread-posts">
                        {group.entries.map((entry, i) =>
                          renderEntryCard(entry, {
                            index: i + 1,
                            total: group.entries.length,
                          })
                        )}
                      </div>
                    </div>
                  );
                }
                return (
                  <React.Fragment key={group.id}>
                    {group.entries.map((e) => renderEntryCard(e))}
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// EntryCard as separate component to handle event delegation for dynamically rendered queue buttons
function EntryCard({
  entry,
  threadPos,
  topicLabel,
  threadBadge,
  pollBadge,
  pollOptionsHtml,
  imageHtml,
  queue,
  postedBadge,
  cardClass,
  onCopy,
  onEdit,
  onSetQueue,
  onUploadImage,
  onRemoveImage,
  onDelete,
  selectable,
  selected,
  onToggleSelect,
}: {
  entry: Entry;
  threadPos?: { index: number; total: number };
  topicLabel: string;
  threadBadge: string;
  pollBadge: string;
  pollOptionsHtml: string;
  imageHtml: string;
  queue: string;
  postedBadge: string;
  cardClass: string;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onCopy: (text: string) => void;
  onEdit: () => void;
  onSetQueue: (id: string, queue: string | null) => void;
  onUploadImage: (id: string, file: File) => void;
  onRemoveImage: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleQueueClick = (q: string) => {
    const isActive = entry.queue === q;
    onSetQueue(entry.id, isActive ? null : q);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUploadImage(entry.id, file);
  };

  const handleCopy = async () => {
    onCopy(entry.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`entry-card${cardClass}${dragOver ? " drag-over" : ""}`}
      data-entry-id={entry.id}
      title="Drag an image here to attach"
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.dataTransfer.types.includes("Files")) setDragOver(false);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={handleDrop}
    >
      <div className={`entry-view${selectable ? " has-checkbox" : ""}`}>
        {selectable && (
          <button
            type="button"
            className={`entry-select-checkbox ${selected ? "checked" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            title={selected ? "Deselect" : "Select"}
            aria-pressed={selected}
          >
            <span className="checkbox-inner">
              {selected && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
          </button>
        )}
        <div className="entry-view-body">
        {threadBadge && <span dangerouslySetInnerHTML={{ __html: threadBadge }} />}
        {topicLabel && <span dangerouslySetInnerHTML={{ __html: topicLabel }} />}
        {pollBadge && <span dangerouslySetInnerHTML={{ __html: pollBadge }} />}
        <div className="entry-text">{entry.text}</div>
        {pollOptionsHtml && (
          <div dangerouslySetInnerHTML={{ __html: pollOptionsHtml }} />
        )}
        {imageHtml && <div dangerouslySetInnerHTML={{ __html: imageHtml }} />}
        <div className="entry-queue">
          <span className="entry-queue-label">Queue:</span>
          {(["8am", "12pm", "4pm", "8pm"] as const).map((q) => (
            <button
              key={q}
              type="button"
              className={`queue-btn ${queue === q ? "active" : ""}`}
              onClick={() => handleQueueClick(q)}
            >
              {q}
            </button>
          ))}
        </div>
        <div className="entry-footer">
          <span className="entry-timestamp">{formatDate(entry.timestamp)}</span>
          {postedBadge && (
            <span dangerouslySetInnerHTML={{ __html: postedBadge }} />
          )}
          <div className="entry-actions">
            <button
              type="button"
              className={`copy-btn ${copied ? "copied" : ""}`}
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <svg
                    className="copy-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg
                    className="copy-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button type="button" className="edit-btn" onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className="attach-image-btn"
              title="Upload image for this tweet"
              onClick={() => fileInputRef.current?.click()}
            >
              Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && file.type.startsWith("image/")) {
                  onUploadImage(entry.id, file);
                }
                e.target.value = "";
              }}
            />
            {entry.imageUrl && (
              <button
                type="button"
                className="remove-image-btn"
                title="Remove attached image"
                onClick={() => onRemoveImage(entry.id)}
              >
                Remove image
              </button>
            )}
            <button type="button" className="delete-btn" onClick={() => onDelete(entry.id)}>
              Delete
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
