import { NextResponse } from "next/server";
import {
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const { data, error } = await supabase
      .from("search_queries")
      .select("id, name, query_string, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ queries: data ?? [] });
  } catch (e) {
    const errMsg = formatSupabaseError(
      e as Parameters<typeof formatSupabaseError>[0]
    );
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: { name?: string; query_string?: string; is_active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const query_string =
    typeof body.query_string === "string" ? body.query_string.trim() : "";
  if (!name || !query_string) {
    return NextResponse.json(
      { error: "name and query_string are required" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("search_queries")
      .insert({
        name,
        query_string,
        is_active: body.is_active !== false,
      })
      .select()
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ query: data });
  } catch (e) {
    const errMsg = formatSupabaseError(
      e as Parameters<typeof formatSupabaseError>[0]
    );
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
