// lib/media.ts
import * as FileSystem from "expo-file-system";
import { nanoid } from "nanoid/non-secure";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const BUCKET = "media";

// --- helpers ---
function extFrom(uri: string) {
  const clean = uri.split("?")[0].toLowerCase();
  const ext = (clean.split(".").pop() || "").toLowerCase();
  return ext || "jpg";
}
function mimeFrom(ext: string) {
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "heic" || ext === "heif") return `image/${ext}`;
  if (ext === "mp4") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  if (ext === "m4v") return "video/x-m4v";
  return "application/octet-stream";
}
function kindFrom(mime: string): "image" | "video" {
  return mime.startsWith("video/") ? "video" : "image";
}

/** Copy Android content:// to a temp file so we can actually read bytes. */
async function normalizeToFileUri(uri: string) {
  if (uri.startsWith("file://")) return uri;

  // Most common culprit: Android content://
  if (Platform.OS === "android" && uri.startsWith("content://")) {
    const ext = extFrom(uri);
    const dest = `${FileSystem.cacheDirectory}upload-${Date.now()}-${nanoid()}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  }

  // Otherwise try as-is (iOS picker usually returns file:// already)
  return uri;
}

/**
 * Upload with correct contentType and return a signed URL.
 * We pass raw bytes so Storage doesn’t create 0‑byte objects.
 */
export async function uploadPostAssetWithProgress(
  userId: string,
  uri: string,
  stamp: number,
  onPct: (pct: number) => void,
): Promise<{ url: string; kind: "image" | "video" }> {
  const fileUri = await normalizeToFileUri(uri);
  const ext = extFrom(fileUri);
  const contentType = mimeFrom(ext);
  const kind = kindFrom(contentType);

  const path = `posts/${userId}/${stamp}-${nanoid()}.${ext}`;

  // Read the file as base64, then convert to bytes so Storage receives non‑empty data.
  const b64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!b64 || b64.length < 8) {
    throw new Error(
      "Selected file could not be read (empty). Try another item.",
    );
  }
  // base64 -> Uint8Array
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    upsert: true,
    // This option is supported at runtime; cast to any if TS complains.
    contentType,
  } as any);
  if (error) throw error;

  // Signed URL (works with private buckets; adjust TTL if you want)
  const { data, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (sErr) throw sErr;

  onPct(100);
  return { url: data.signedUrl, kind };
}
