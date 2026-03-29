import { NextResponse } from "next/server";
import {
  requireSupabaseStorage,
  formatSupabaseError,
  isPostgresUndefinedColumnError,
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
    const full = await supabase
      .from("search_queries")
      .select("id, name, query_string, is_active, created_at, query_options")
      .order("created_at", { ascending: false });
    let data = full.data;
    let error = full.error;
    if (error && isPostgresUndefinedColumnError(error, "query_options")) {
      const fallback = await supabase
        .from("search_queries")
        .select("id, name, query_string, is_active, created_at")
        .order("created_at", { ascending: false });
      data = fallback.data as typeof full.data;
      error = fallback.error;
    }
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

  let body: {
    name?: string;
    query_string?: string;
    is_active?: boolean;
    query_options?: unknown;
  };
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

  const insertPayload: Record<string, unknown> = {
    name,
    query_string,
    is_active: body.is_active !== false,
  };
  if (body.query_options !== undefined) {
    insertPayload.query_options = body.query_options;
  }

  try {
    let { data, error } = await supabase
      .from("search_queries")
      .insert(insertPayload)
      .select()
      .maybeSingle();
    if (
      error &&
      "query_options" in insertPayload &&
      isPostgresUndefinedColumnError(error, "query_options")
    ) {
      const { query_options: _q, ...rest } = insertPayload;
      ({ data, error } = await supabase
        .from("search_queries")
        .insert(rest)
        .select()
        .maybeSingle());
    }
    if (error) throw error;
    return NextResponse.json({ query: data });
  } catch (e) {
    const errMsg = formatSupabaseError(
      e as Parameters<typeof formatSupabaseError>[0]
    );
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
