"use client";

import * as React from "react";

export const APP_SYNC_EVENT = "xcom:sync-now";
const APP_SYNC_COOLDOWN_MS = 2_500;

export function triggerAppSync(): void {
  window.dispatchEvent(new Event(APP_SYNC_EVENT));
}

export function useAppSync(handler: () => void, enabled = true): void {
  const lastRunRef = React.useRef(0);

  React.useEffect(() => {
    if (!enabled) return;

    const run = () => {
      const now = Date.now();
      if (now - lastRunRef.current < APP_SYNC_COOLDOWN_MS) return;
      lastRunRef.current = now;
      handler();
    };

    const onOnline = () => run();
    const onFocus = () => run();
    const onVisible = () => {
      if (!document.hidden) run();
    };
    const onSync = () => run();

    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(APP_SYNC_EVENT, onSync);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(APP_SYNC_EVENT, onSync);
    };
  }, [enabled, handler]);
}

