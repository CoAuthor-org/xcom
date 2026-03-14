import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/generate-from-notes-jobs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({
    status: job.status,
    logs: job.logs,
    tweets: job.tweets,
    runsDone: job.runsDone,
    postsCount: job.postsCount,
    savedCount: job.savedCount,
    usage: job.usage,
    error: job.error,
    startIndex: job.startIndex,
    totalChunks: job.totalChunks,
  });
}
