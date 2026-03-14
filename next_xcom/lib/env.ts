/**
 * Load .env from project root (xcom). When running from next_xcom, cwd is next_xcom,
 * so we load from parent. Supports both standalone next_xcom and monorepo layouts.
 */
import path from "path";
import { config } from "dotenv";

export function loadEnv() {
  if (typeof window !== "undefined") return;
  try {
    const cwd = process.cwd();
    config({ path: path.join(cwd, ".env") });
  } catch {
    // dotenv may not be needed if env is already set
  }
}

/** Project root - everything lives inside next_xcom after migration */
export function getProjectRoot(): string {
  return process.cwd();
}
