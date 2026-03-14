import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { resetProgressForFile, getNotesFilePath } from "@/lib/notes";

export async function POST(request: NextRequest) {
  let body: { file?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { file } = body;
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
  try {
    await resetProgressForFile(file);
    return NextResponse.json({
      success: true,
      message: `Pointer reset for ${file}. Next run will start from the top.`,
    });
  } catch (e) {
    console.error("notes/progress/reset:", e);
    return NextResponse.json(
      { error: (e as Error).message || "Failed to reset progress" },
      { status: 500 }
    );
  }
}
