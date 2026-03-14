import { NextRequest, NextResponse } from "next/server";
import { getNotesContent, getNotesFilePath } from "@/lib/notes";

export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get("file");
  if (!file) {
    return NextResponse.json(
      { error: "file query required" },
      { status: 400 }
    );
  }
  const result = getNotesContent(file);
  if (!result) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
