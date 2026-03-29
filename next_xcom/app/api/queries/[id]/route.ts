import { NextResponse } from "next/server";
import {
  requireSupabaseStorage,
  formatSupabaseError,
  isPostgresUndefinedColumnError,
} from "@/lib/entries";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  let body: {
    name?: string;
    query_string?: string;
    is_active?: boolean;
    query_options?: unknown | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.query_string === "string") {
    patch.query_string = body.query_string.trim();
  }
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  if (body.query_options !== undefined) {
    patch.query_options = body.query_options;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  try {
    let { data, error } = await supabase
      .from("search_queries")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (
      error &&
      "query_options" in patch &&
      isPostgresUndefinedColumnError(error, "query_options")
    ) {
      const { query_options: _q, ...rest } = patch;
      if (Object.keys(rest).length === 0) {
        return NextResponse.json(
          {
            error:
              "Cannot persist query_options until migration 010_search_queries_options.sql is applied in Supabase.",
          },
          { status: 503 }
        );
      }
      ({ data, error } = await supabase
        .from("search_queries")
        .update(rest)
        .eq("id", id)
        .select()
        .maybeSingle());
    }
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ query: data });
  } catch (e) {
    const errMsg = formatSupabaseError(
      e as Parameters<typeof formatSupabaseError>[0]
    );
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { id } = await context.params;

  try {
    const { error } = await supabase.from("search_queries").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const errMsg = formatSupabaseError(
      e as Parameters<typeof formatSupabaseError>[0]
    );
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
