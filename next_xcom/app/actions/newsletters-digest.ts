"use server";

import { runNewsletterBatchSummarize } from "@/lib/newsletters/batch-runner";

/** Runs the same batch summarization as the daily cron; safe to call from the UI (server-side). */
export async function triggerNewsletterDigestSummarizeAction() {
  return runNewsletterBatchSummarize();
}
