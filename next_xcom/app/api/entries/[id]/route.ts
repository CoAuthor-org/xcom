import { NextRequest, NextResponse } from "next/server";
import {
  updateEntryById,
  deleteEntryById,
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });
  }
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { text } = body;
  if (!text || text.length > 280) {
    return NextResponse.json(
      { error: "Text must be between 1 and 280 characters" },
      { status: 400 }
    );
  }
  try {
    const entry = await updateEntryById(id, text.slice(0, 280));
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      message: "Entry updated",
      entry,
    });
  } catch (e) {
    const errMsg = formatSupabaseError(e as Parameters<typeof formatSupabaseError>[0]);
    console.error("PUT /entries/:id:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });
  }
  try {
    const ok = await deleteEntryById(id);
    if (!ok) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Entry deleted" });
  } catch (e) {
    const errMsg = formatSupabaseError(e as Parameters<typeof formatSupabaseError>[0]);
    console.error("DELETE /entries/:id:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
