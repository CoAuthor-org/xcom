import fs from "fs";
import path from "path";
import { supabase } from "./supabase";
import { getProjectRoot } from "./env";

const projectRoot = getProjectRoot();
const notesDir = path.join(projectRoot, "notes");
const progressPath = path.join(projectRoot, "progress.json");
const notesToTweetsPromptPath = path.join(
  projectRoot,
  "prompts",
  "notes-to-tweets.prompt.txt"
);

const CHUNK_CHAR_LIMIT = 8000;
const MAX_CHUNKS_PER_REQUEST = 20;

export function getNotesFilePath(filename: string): string | null {
  const base = path.basename(filename, path.extname(filename)) + ".md";
  const resolved = path.resolve(notesDir, base);
  const notesDirResolved = path.resolve(notesDir);
  if (
    !resolved.startsWith(notesDirResolved) ||
    path.extname(resolved) !== ".md"
  ) {
    return null;
  }
  return resolved;
}

export function getNotesFiles(): string[] {
  if (!fs.existsSync(notesDir)) return [];
  return fs
    .readdirSync(notesDir)
    .filter((f) => path.extname(f).toLowerCase() === ".md")
    .sort();
}

export function getNotesContent(file: string): { content: string; filename: string } | null {
  const filePath = getNotesFilePath(file);
  if (!filePath || !fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf8");
  return { content, filename: path.basename(filePath) };
}

export function loadNotesToTweetsPrompt(): string | null {
  try {
    if (fs.existsSync(notesToTweetsPromptPath)) {
      return fs.readFileSync(notesToTweetsPromptPath, "utf8").trim();
    }
  } catch (e) {
    console.warn("Could not load notes-to-tweets prompt file:", (e as Error).message);
  }
  return null;
}

export function chunkMarkdown(content: string): string[] {
  const chunks: string[] = [];
  const sections = content.split(/(?=^##\s)/m);
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    if (trimmed.length <= CHUNK_CHAR_LIMIT) {
      chunks.push(trimmed);
    } else {
      for (let i = 0; i < trimmed.length; i += CHUNK_CHAR_LIMIT) {
        chunks.push(trimmed.slice(i, i + CHUNK_CHAR_LIMIT));
      }
    }
  }
  if (chunks.length === 0 && content.trim()) {
    for (let i = 0; i < content.length; i += CHUNK_CHAR_LIMIT) {
      chunks.push(content.slice(i, i + CHUNK_CHAR_LIMIT));
    }
  }
  return chunks.slice(0, MAX_CHUNKS_PER_REQUEST);
}

export async function readProgress(): Promise<Record<string, number>> {
  if (supabase) {
    const { data, error } = await supabase
      .from("note_progress")
      .select("file_name, last_chunk_index");
    if (error) throw error;
    const out: Record<string, number> = {};
    (data || []).forEach(
      (row: { file_name: string; last_chunk_index: number }) => {
        out[row.file_name] = row.last_chunk_index;
      }
    );
    return out;
  }
  if (fs.existsSync(progressPath)) {
    try {
      const raw = fs.readFileSync(progressPath, "utf8");
      if (raw.trim()) return JSON.parse(raw) as Record<string, number>;
    } catch {
      // ignore
    }
  }
  return {};
}

export async function writeProgress(progress: Record<string, number>): Promise<void> {
  if (supabase) {
    for (const [file_name, last_chunk_index] of Object.entries(progress)) {
      await supabase
        .from("note_progress")
        .upsert({ file_name, last_chunk_index }, { onConflict: "file_name" });
    }
    return;
  }
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

export async function resetProgressForFile(file: string): Promise<void> {
  const prog = await readProgress();
  prog[file] = 0;
  await writeProgress(prog);
}
