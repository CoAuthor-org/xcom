import { NextRequest, NextResponse } from "next/server";
import { isInitialized, notesToTweets, notesToPoll, stripAttachPlaceholders, trimToTweetLength } from "@/lib/llm";
import { requireSupabaseStorage, insertEntry } from "@/lib/entries";
import {
  getNotesFilePath,
  chunkMarkdown,
  loadNotesToTweetsPrompt,
  readProgress,
  writeProgress,
} from "@/lib/notes";
import { setJob, nextJobId } from "@/lib/generate-from-notes-jobs";
import fs from "fs";

export async function POST(request: NextRequest) {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  if (!isInitialized()) {
    return NextResponse.json(
      { error: "LLM not configured. Set XAI_API_KEY." },
      { status: 503 }
    );
  }
  let body: { file?: string; postsCount?: number; isThread?: boolean; threadLength?: number; isPoll?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { file, postsCount: requestedCount, isThread, threadLength: requestedThreadLength, isPoll } = body;
  if (!file) {
    return NextResponse.json(
      { error: "file is required" },
      { status: 400 }
    );
  }
  const filePath = getNotesFilePath(file);
  if (!filePath || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  const content = fs.readFileSync(filePath, "utf8");
  const chunks = chunkMarkdown(content);
  if (chunks.length === 0) {
    return NextResponse.json({
      success: true,
      jobId: null,
      tweets: [],
      chunksProcessed: 0,
    });
  }

  const isPollMode = isPoll === true;
  const isThreadMode = !isPollMode && isThread === true;
  const threadLength = isThreadMode
    ? Math.min(6, Math.max(2, parseInt(String(requestedThreadLength), 10) || 3))
    : 0;
  const postsCount = isThreadMode
    ? threadLength
    : Math.min(50, Math.max(1, parseInt(String(requestedCount), 10) || 10));
  const DEFAULT_POLL_DURATION_MINUTES = 1440;
  const progress = await readProgress();
  let startIndex =
    progress[file] != null
      ? Math.min(progress[file], chunks.length - 1)
      : 0;
  if (startIndex >= chunks.length) startIndex = 0;

  const jobId = nextJobId();
  const job: import("@/lib/generate-from-notes-jobs").GenerateFromNotesJob = {
    file,
    status: "running",
    logs: [],
    tweets: [],
    runsDone: 0,
    savedCount: 0,
    usage: { promptTokens: 0, completionTokens: 0 },
    startIndex,
    totalChunks: chunks.length,
    postsCount,
    error: null,
  };
  setJob(jobId, job);

  const systemPrompt = loadNotesToTweetsPrompt();
  const addLog = (msg: string, kind = "msg") => {
    job.logs.push({ msg, kind });
  };

  const threadId = isThreadMode ? crypto.randomUUID() : null;

  (async () => {
    try {
      addLog(
        isPollMode
          ? `Starting: ${file}. Generating ${postsCount} poll(s). ${chunks.length} segment(s) for context.`
          : isThreadMode
            ? `Starting: ${file}. Generating 1 thread with ${postsCount} post(s). ${chunks.length} segment(s) for context.`
            : `Starting: ${file}. Generating ${postsCount} post(s), 1 per LLM run. ${chunks.length} segment(s) for context.`
      );
      for (let run = 0; run < postsCount; run++) {
        const chunkIndex = (startIndex + run) % chunks.length;
        const chunk = chunks[chunkIndex];
        addLog(
          `Run ${run + 1}/${postsCount} (segment ${chunkIndex + 1}/${chunks.length}, ${chunk.length} chars) → LLM (${isPollMode ? "1 poll" : "1 post"})...`
        );
        if (isPollMode) {
          const result = await notesToPoll(chunk, {
            systemPrompt: systemPrompt ?? undefined,
          });
          if (result.usage) {
            job.usage.promptTokens += result.usage.promptTokens || 0;
            job.usage.completionTokens += result.usage.completionTokens || 0;
            addLog(
              `  tokens: prompt=${result.usage.promptTokens} completion=${result.usage.completionTokens}`
            );
          }
          const poll = result.poll;
          if (!poll || poll.options.length < 2 || poll.options.length > 4) {
            addLog("  no valid poll from this run (need 2–4 options)", "err");
          } else {
            const options = poll.options.map((o) =>
              o.length > 25 ? o.slice(0, 25) : o
            );
            const saved = await insertEntry({
              text: poll.text,
              pollOptions: options,
              pollDurationMinutes: DEFAULT_POLL_DURATION_MINUTES,
            });
            job.tweets.push({
              id: saved.id,
              text: saved.text,
              topicRef: saved.topicRef,
              part: saved.part,
            });
            job.savedCount = job.tweets.length;
            const preview =
              poll.text.length > 60 ? poll.text.slice(0, 57) + "..." : poll.text;
            addLog(
              `  saved poll ${job.tweets.length}: "${preview}" [${options.length} options]`,
              "ok"
            );
          }
        } else {
          const result = await notesToTweets(chunk, {
            systemPrompt: systemPrompt ?? undefined,
            onePostOnly: true,
          });
          if (result.usage) {
            job.usage.promptTokens += result.usage.promptTokens || 0;
            job.usage.completionTokens += result.usage.completionTokens || 0;
            addLog(
              `  tokens: prompt=${result.usage.promptTokens} completion=${result.usage.completionTokens}`
            );
          }
          const tweets = result.tweets || [];
          const tw = tweets[0];
          if (!tw) {
            addLog("  no post from this run", "err");
          } else {
            let text = typeof tw === "string" ? tw : tw.text;
            text = stripAttachPlaceholders(text);
            const safe =
              text.length <= 280 ? text : trimToTweetLength(text).slice(0, 280);
            const entryPayload: {
              text: string;
              topicRef?: string;
              part?: number;
              threadId?: string;
              threadIndex?: number;
            } = { text: safe };
            if (tw.topicRef != null) entryPayload.topicRef = tw.topicRef;
            if (tw.part != null) entryPayload.part = tw.part;
            if (threadId) {
              entryPayload.threadId = threadId;
              entryPayload.threadIndex = run + 1;
            }
            const saved = await insertEntry(entryPayload);
            job.tweets.push({
              id: saved.id,
              text: saved.text,
              topicRef: saved.topicRef,
              part: saved.part,
            });
            job.savedCount = job.tweets.length;
            const preview = text.length > 60 ? text.slice(0, 57) + "..." : text;
            addLog(`  saved post ${job.tweets.length}: "${preview}"`, "ok");
          }
        }
        job.runsDone = run + 1;
      }
      const prog = await readProgress();
      prog[file] = (startIndex + postsCount) % chunks.length;
      await writeProgress(prog);
      addLog(`Done. Generated ${job.savedCount} post(s) in ${postsCount} run(s).`);
      job.status = "done";
    } catch (error) {
      console.error("generate-from-notes:", (error as Error).message);
      job.status = "error";
      job.error = (error as Error).message ?? "Unknown error";
      addLog(`Error: ${(error as Error).message}`, "err");
      const prog = await readProgress();
      prog[file] = startIndex;
      await writeProgress(prog);
    }
  })();

  return NextResponse.json({ success: true, jobId });
}
