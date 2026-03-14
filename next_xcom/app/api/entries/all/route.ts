import { NextResponse } from "next/server";
import {
  deleteAllEntries,
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";

export async function DELETE() {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  try {
    await deleteAllEntries();
    return NextResponse.json({ success: true, message: "All entries deleted" });
  } catch (e) {
    const errMsg = formatSupabaseError(e as Parameters<typeof formatSupabaseError>[0]);
    console.error("DELETE /entries/all:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
