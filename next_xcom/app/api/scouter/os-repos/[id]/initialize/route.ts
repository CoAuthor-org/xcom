import { NextResponse } from "next/server";
import { requireSupabaseStorage } from "@/lib/entries";
import { supabase } from "@/lib/supabase";
import { updateRepoStatus } from "@/lib/scouter/supabase";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const err = requireSupabaseStorage();
  if (err) return NextResponse.json({ error: err.error }, { status: 503 });
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id } = await context.params;
  const { data: row, error: rowError } = await supabase
    .from("scouter_os_repos")
    .select("id, url")
    .eq("id", id)
    .maybeSingle();
  if (rowError) {
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: "Repo not found" }, { status: 404 });

  try {
    const res = await fetch("http://localhost:9999/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_url: row.url }),
    });
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      return NextResponse.json(
        { error: `Local agent clone failed (${res.status}): ${body}` },
        { status: 502 }
      );
    }
    await updateRepoStatus(id, "cloned");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
