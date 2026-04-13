"use client";

const MAX_CACHE_AGE_MS = 12 * 60 * 60 * 1000;

type CacheEnvelope<T> = {
  savedAt: number;
  value: T;
};

export function readLocalCache<T>(key: string, maxAgeMs = MAX_CACHE_AGE_MS): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > maxAgeMs) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export function writeLocalCache<T>(key: string, value: T): void {
  try {
    const payload: CacheEnvelope<T> = {
      savedAt: Date.now(),
      value,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota and serialization errors.
  }
}

export function removeLocalCache(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

