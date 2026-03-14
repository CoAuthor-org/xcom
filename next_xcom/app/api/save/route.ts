import { NextRequest, NextResponse } from "next/server";
import {
  insertEntry,
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";

export async function POST(request: NextRequest) {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const { text } = body;
  if (!text || text.length > 280) {
    return NextResponse.json(
      { error: "Text must be between 1 and 280 characters" },
      { status: 400 }
    );
  }
  try {
    const entry = await insertEntry({ text });
    return NextResponse.json({
      success: true,
      message: "Text saved successfully",
      entry,
    });
  } catch (e) {
    const errMsg = formatSupabaseError(e as Parameters<typeof formatSupabaseError>[0]);
    console.error("POST /save:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
