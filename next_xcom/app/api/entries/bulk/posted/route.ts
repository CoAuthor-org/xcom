import { NextResponse } from "next/server";
import {
  deletePostedEntries,
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";

/** DELETE here (not under /entries/posted) so Next does not match [id] with id="posted". */
export async function DELETE() {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  try {
    const { deleted } = await deletePostedEntries();
    return NextResponse.json({
      success: true,
      deleted,
      message:
        deleted === 0
          ? "No posted entries to delete"
          : `Deleted ${deleted} posted ${deleted === 1 ? "entry" : "entries"}`,
    });
  } catch (e) {
    const errMsg = formatSupabaseError(e as Parameters<typeof formatSupabaseError>[0]);
    console.error("DELETE /entries/bulk/posted:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
