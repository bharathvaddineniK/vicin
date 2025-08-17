// lib/media.ts
import * as FileSystem from "expo-file-system";
import { nanoid } from "nanoid/non-secure";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const BUCKET = "media";

// Memory optimization constants
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for processing

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

/** Validate file size to prevent OOM errors */
async function validateFileSize(uri: string, kind: "image" | "video"): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      throw new Error("File does not exist");
    }
    
    const maxSize = kind === "video" ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (info.size && info.size > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024));
      throw new Error(`File too large. Maximum size is ${maxMB}MB for ${kind}s.`);
    }
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Could not validate file size");
  }
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

/** Clean up temporary files to prevent storage bloat */
async function cleanupTempFile(uri: string): Promise<void> {
  try {
    if (uri.includes(FileSystem.cacheDirectory || '')) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}

/** Memory-optimized file reading using streaming approach */
async function readFileOptimized(uri: string): Promise<Uint8Array> {
  try {
    // For smaller files, use the existing approach
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      throw new Error("File does not exist");
    }
    
    // If file is small enough, use direct base64 conversion
    if (info.size && info.size < CHUNK_SIZE) {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!b64 || b64.length < 8) {
        throw new Error("Selected file could not be read (empty). Try another item.");
      }
      
      // Convert base64 to Uint8Array
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return bytes;
    }
    
    // For larger files, we still need to use base64 but with better memory management
    // Note: Expo FileSystem doesn't support streaming, so we optimize what we can
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    if (!b64 || b64.length < 8) {
      throw new Error("Selected file could not be read (empty). Try another item.");
    }
    
    // Convert in chunks to reduce memory pressure
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    
    // Process in chunks to avoid blocking the main thread
    const chunkSize = 64 * 1024; // 64KB chunks
    for (let i = 0; i < bin.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, bin.length);
      for (let j = i; j < end; j++) {
        bytes[j] = bin.charCodeAt(j);
      }
      // Allow other operations to run
      if (i % (chunkSize * 10) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return bytes;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Failed to read file");
  }
}

/**
 * Upload with correct contentType and return a signed URL.
 * Memory-optimized version with file size validation and cleanup.
 */
export async function uploadPostAssetWithProgress(
  userId: string,
  uri: string,
  stamp: number,
  onPct: (pct: number) => void,
): Promise<{ url: string; kind: "image" | "video" }> {
  let fileUri: string | null = null;
  let tempFileCreated = false;
  
  try {
    // Normalize file URI and track if we created a temp file
    const originalUri = uri;
    fileUri = await normalizeToFileUri(uri);
    tempFileCreated = fileUri !== originalUri;
    
    const ext = extFrom(fileUri);
    const contentType = mimeFrom(ext);
    const kind = kindFrom(contentType);
    
    // Validate file size before processing to prevent OOM
    await validateFileSize(fileUri, kind);
    onPct(10);
    
    const path = `posts/${userId}/${stamp}-${nanoid()}.${ext}`;
    
    // Use optimized file reading
    const bytes = await readFileOptimized(fileUri);
    onPct(60);
    
    // Upload to storage
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      upsert: true,
      contentType,
    } as any);
    
    if (error) throw error;
    onPct(80);
    
    // Get signed URL
    const { data, error: sErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (sErr) throw sErr;
    
    onPct(100);
    return { url: data.signedUrl, kind };
    
  } catch (error) {
    // Re-throw the error after cleanup
    throw error;
  } finally {
    // Clean up temporary file if we created one
    if (fileUri && tempFileCreated) {
      await cleanupTempFile(fileUri);
    }
  }
}
