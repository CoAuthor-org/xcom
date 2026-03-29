"use client";

import * as React from "react";

/**
 * State mirrored to localStorage. Loads after mount; skips the first write so
 * the initial default does not overwrite a stored value before load runs.
 */
export function useLocalStorageStringState<T extends string>(
  key: string,
  defaultValue: T,
  allowed: readonly T[]
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = React.useState<T>(defaultValue);
  const skipFirstWrite = React.useRef(true);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw && (allowed as readonly string[]).includes(raw)) {
        setValue(raw as T);
      }
    } catch {
      /* quota / private mode */
    }
  }, [key, allowed]);

  React.useEffect(() => {
    if (skipFirstWrite.current) {
      skipFirstWrite.current = false;
      return;
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue];
}
