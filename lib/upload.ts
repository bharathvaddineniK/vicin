// /lib/upload.ts
import { decode as atob } from "base-64";
import * as FileSystem from "expo-file-system";
import { supabase } from "./supabase";

/** Convert a base64 string to an ArrayBuffer */
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Best-effort contentType based on file extension; defaults to image/jpeg */
function guessContentTypeFromUri(uri: string): string {
  const clean = uri.split("?")[0];
  const ext = (clean.split(".").pop() || "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

/**
 * Upload an image from a local file URI (expo-image-picker asset) to Supabase Storage.
 * Returns a PUBLIC URL (since your bucket is public).
 */
export async function uploadImageFromUri(
  userId: string,
  uri: string,
): Promise<string | null> {
  // 1) Read file as base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // 2) -> bytes
  const ab = base64ToArrayBuffer(base64);
  const contentType = guessContentTypeFromUri(uri);

  // 3) Unique storage path
  const ext = contentType.split("/")[1] || "jpg";
  const path = `avatars/${userId}-${Date.now()}.${ext}`;

  // 4) Upload bytes (ArrayBuffer is supported by supabase-js)
  const { error } = await supabase.storage
    .from("images")
    .upload(path, ab, { upsert: true, contentType });

  if (error) {
    console.log("[Upload] error", error);
    throw error;
  }

  // 5) Public URL
  const { data } = supabase.storage.from("images").getPublicUrl(path);
  const publicUrl = data?.publicUrl ?? null;
  console.log("[Upload] success →", publicUrl);
  return publicUrl;
}
