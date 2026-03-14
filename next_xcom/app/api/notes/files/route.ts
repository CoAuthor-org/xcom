import { NextResponse } from "next/server";
import { getNotesFiles } from "@/lib/notes";

export async function GET() {
  const files = getNotesFiles();
  return NextResponse.json({ files });
}
