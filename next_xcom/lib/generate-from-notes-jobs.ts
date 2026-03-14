/**
 * In-memory job store for generate-from-notes.
 * Works for single-process dev. Use Redis or similar for serverless/multi-instance.
 */
export interface GenerateFromNotesJob {
  file: string;
  status: string;
  logs: Array<{ msg: string; kind: string }>;
  tweets: Array<{
    id: string;
    text: string;
    topicRef?: string;
    part?: number;
  }>;
  runsDone: number;
  savedCount: number;
  usage: { promptTokens: number; completionTokens: number };
  startIndex: number;
  totalChunks: number;
  postsCount: number;
  error: string | null;
}

const jobs = new Map<string, GenerateFromNotesJob>();

export function setJob(id: string, job: GenerateFromNotesJob): void {
  jobs.set(id, job);
}

export function getJob(id: string): GenerateFromNotesJob | undefined {
  return jobs.get(id);
}

export function nextJobId(): string {
  return "job_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
}
