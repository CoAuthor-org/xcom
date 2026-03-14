import { NextRequest, NextResponse } from "next/server";
import {
  updateEntryQueueById,
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";

export async function PATCH(
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
  let body: { queue?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const queue =
    body?.queue === "10am" || body?.queue === "6pm" ? body.queue : null;
  try {
    const entry = await updateEntryQueueById(id, queue ?? "");
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      message: queue ? `Queue set to ${queue}` : "Queue cleared",
      entry,
    });
  } catch (e) {
    const errMsg = formatSupabaseError(e as Parameters<typeof formatSupabaseError>[0]);
    console.error("PATCH /entries/:id/queue:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
