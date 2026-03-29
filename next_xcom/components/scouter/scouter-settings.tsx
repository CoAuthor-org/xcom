"use client";

export function ScouterSettings() {
  return (
    <div className="scouter-panel">
      <div className="scouter-panel-head">
        <div>
          <h3 className="scouter-panel-title">Settings</h3>
          <p className="scouter-panel-sub">
            Configure provider keys, feed sources, and worker integration progressively.
          </p>
        </div>
      </div>
      <div className="sc-empty">
        This section is intentionally isolated from existing app settings.
      </div>
    </div>
  );
}
