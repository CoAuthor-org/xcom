import { NextResponse } from "next/server";
import {
  clearAllQueues,
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";

export async function PATCH() {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  try {
    const { cleared } = await clearAllQueues();
    return NextResponse.json({
      success: true,
      cleared,
      message: cleared === 0 ? "No queued posts" : `Removed ${cleared} post(s) from queues`,
    });
  } catch (e) {
    const errMsg = formatSupabaseError(e as Parameters<typeof formatSupabaseError>[0]);
    console.error("PATCH /entries/queue:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
