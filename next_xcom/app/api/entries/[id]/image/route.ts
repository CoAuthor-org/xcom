import { NextRequest, NextResponse } from "next/server";
import { supabase, TWEET_IMAGES_BUCKET } from "@/lib/supabase";
import {
  requireSupabaseStorage,
  formatSupabaseError,
} from "@/lib/entries";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  if (!supabase) {
    return NextResponse.json(
      { error: "Image upload requires Supabase." },
      { status: 503 }
    );
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }
  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: 'No image file uploaded. Use form field name "image".' },
      { status: 400 }
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimetype = file.type || "image/jpeg";
  const ext =
    file.name && file.name.includes(".")
      ? "." + file.name.split(".").pop()
      : mimetype === "image/png"
        ? ".png"
        : mimetype === "image/webp"
          ? ".webp"
          : ".jpg";
  const storagePath = `${id}/image${ext}`;
  try {
    const { error: uploadError } = await supabase.storage
      .from(TWEET_IMAGES_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimetype,
        upsert: true,
      });
    if (uploadError) throw uploadError;
    const {
      data: { publicUrl },
    } = supabase.storage.from(TWEET_IMAGES_BUCKET).getPublicUrl(storagePath);
    const { error: updateError } = await supabase
      .from("entries")
      .update({ image_url: publicUrl })
      .eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({ success: true, imageUrl: publicUrl });
  } catch (e) {
    const errMsg = formatSupabaseError(e as Parameters<typeof formatSupabaseError>[0]);
    console.error("POST /entries/:id/image:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = requireSupabaseStorage();
  if (err) {
    return NextResponse.json({ error: err.error }, { status: 503 });
  }
  if (!supabase) {
    return NextResponse.json(
      { error: "Image removal requires Supabase." },
      { status: 503 }
    );
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });
  }
  try {
    const { data: entry } = await supabase
      .from("entries")
      .select("image_url")
      .eq("id", id)
      .single();
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (entry.image_url) {
      const match = (entry.image_url as string).match(/\/tweet-images\/(.+)$/);
      if (match && match[1]) {
        await supabase.storage
          .from(TWEET_IMAGES_BUCKET)
          .remove([decodeURIComponent(match[1])]);
      }
    }
    const { error: updateError } = await supabase
      .from("entries")
      .update({ image_url: null })
      .eq("id", id);
    if (updateError) throw updateError;
    return NextResponse.json({ success: true, message: "Image removed" });
  } catch (e) {
    const errMsg = formatSupabaseError(e as Parameters<typeof formatSupabaseError>[0]);
    console.error("DELETE /entries/:id/image:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
