import { NextResponse } from "next/server";
import { supabaseStatus } from "@/lib/supabase";

export async function GET() {
  const s = supabaseStatus();
  return NextResponse.json({
    storage: s.ok ? "supabase" : "local",
    reason: s.reason ?? null,
    url: s.url ?? null,
  });
}
