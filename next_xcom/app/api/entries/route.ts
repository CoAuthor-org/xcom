import { NextResponse } from "next/server";
import {
  getEntries,
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";

export async function GET() {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  try {
    const entries = await getEntries();
    return NextResponse.json({ entries });
  } catch (e) {
    const errMsg = formatSupabaseError(e as Parameters<typeof formatSupabaseError>[0]);
    console.error("GET /entries:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
