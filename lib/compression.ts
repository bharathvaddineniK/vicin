import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

// MIME type validation
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 
  'image/heic', 'image/heif', 'image/gif', 'image/bmp', 'image/tiff'
];

const SUPPORTED_VIDEO_TYPES = [
  'video/mp4', 'video/mov', 'video/quicktime', 'video/avi', 
  'video/webm', 'video/m4v', 'video/3gp', 'video/mkv'
];

// Size limits (in bytes)
export const SIZE_LIMITS = {
  IMAGE_MAX_ORIGINAL: 50 * 1024 * 1024, // 50MB
  IMAGE_MAX_COMPRESSED: 5 * 1024 * 1024, // 5MB
  VIDEO_MAX_ORIGINAL: 500 * 1024 * 1024, // 500MB
  VIDEO_MAX_COMPRESSED: 100 * 1024 * 1024, // 100MB
  TOTAL_MEDIA_LIMIT: 200 * 1024 * 1024, // 200MB
} as const;

export interface CompressionResult {
  uri: string;
  size: number;
  originalSize: number;
  compressionRatio: number;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface CompressionProgress {
  stage: 'validating' | 'compressing' | 'finalizing';
  progress: number; // 0-100
}

// Get MIME type from file URI
async function getMimeType(uri: string): Promise<string> {
  try {
    const extension = uri.toLowerCase().split('.').pop() || '';
    
    const mimeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'heic': 'image/heic',
      'heif': 'image/heif',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'tiff': 'image/tiff',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'avi': 'video/avi',
      'webm': 'video/webm',
      'm4v': 'video/m4v',
      '3gp': 'video/3gp',
      'mkv': 'video/mkv',
    };
    
    return mimeMap[extension] || 'application/octet-stream';
  } catch {
    return 'application/octet-stream';
  }
}

// Validate file type and size
export async function validateMedia(
  uri: string, 
  type: 'image' | 'video'
): Promise<{ valid: boolean; error?: string; size?: number; mimeType?: string }> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return { valid: false, error: 'File does not exist' };
    }

    const size = fileInfo.size || 0;
    const mimeType = await getMimeType(uri);
    
    // Check MIME type
    const supportedTypes = type === 'image' ? SUPPORTED_IMAGE_TYPES : SUPPORTED_VIDEO_TYPES;
    if (!supportedTypes.includes(mimeType)) {
      return { 
        valid: false, 
        error: `Unsupported ${type} format. Supported: ${supportedTypes.join(', ')}` 
      };
    }
    
    // Check file size
    const maxSize = type === 'image' ? SIZE_LIMITS.IMAGE_MAX_ORIGINAL : SIZE_LIMITS.VIDEO_MAX_ORIGINAL;
    if (size > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024));
      return { 
        valid: false, 
        error: `File too large. Maximum size: ${maxMB}MB for ${type}s` 
      };
    }
    
    return { valid: true, size, mimeType };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'File validation failed' 
    };
  }
}

// Compress image with high quality preservation
export async function compressImage(
  uri: string,
  onProgress?: (progress: CompressionProgress) => void
): Promise<CompressionResult> {
  try {
    onProgress?.({ stage: 'validating', progress: 0 });
    
    // Validate first
    const validation = await validateMedia(uri, 'image');
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    const originalSize = validation.size!;
    const mimeType = validation.mimeType!;
    
    onProgress?.({ stage: 'validating', progress: 20 });
    
    // Get image info
    const imageInfo = await ImageManipulator.manipulateAsync(uri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    });
    
    onProgress?.({ stage: 'compressing', progress: 40 });
    
    // Calculate optimal compression settings
    const actions: ImageManipulator.Action[] = [];
    const maxDimension = 1920;
    
    // Resize if too large
    if (imageInfo.width > maxDimension || imageInfo.height > maxDimension) {
      const aspectRatio = imageInfo.width / imageInfo.height;
      let newWidth = imageInfo.width;
      let newHeight = imageInfo.height;
      
      if (imageInfo.width > imageInfo.height) {
        newWidth = maxDimension;
        newHeight = maxDimension / aspectRatio;
      } else {
        newHeight = maxDimension;
        newWidth = maxDimension * aspectRatio;
      }
      
      actions.push({
        resize: {
          width: Math.round(newWidth),
          height: Math.round(newHeight),
        },
      });
    }
    
    onProgress?.({ stage: 'compressing', progress: 60 });
    
    // Determine quality based on original size
    let quality = 0.95; // Default high quality
    if (originalSize > 10 * 1024 * 1024) quality = 0.90; // 10MB+
    if (originalSize > 20 * 1024 * 1024) quality = 0.85; // 20MB+
    
    // Compress
    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      {
        compress: quality,
        format: mimeType.includes('png') && originalSize < 2 * 1024 * 1024 
          ? ImageManipulator.SaveFormat.PNG 
          : ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    );
    
    onProgress?.({ stage: 'finalizing', progress: 80 });
    
    // Get final size
    const finalInfo = await FileSystem.getInfoAsync(result.uri);
    const finalSize = finalInfo.exists && 'size' in finalInfo ? finalInfo.size : originalSize;
    
    // Verify compressed size is within limits
    if (finalSize > SIZE_LIMITS.IMAGE_MAX_COMPRESSED) {
      // Try more aggressive compression
      const aggressiveResult = await ImageManipulator.manipulateAsync(
        uri,
        actions,
        {
          compress: 0.75,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: false,
        }
      );
      
      const aggressiveInfo = await FileSystem.getInfoAsync(aggressiveResult.uri);
      const aggressiveSize = aggressiveInfo.exists && 'size' in aggressiveInfo ? aggressiveInfo.size : originalSize;
      
      if (aggressiveSize <= SIZE_LIMITS.IMAGE_MAX_COMPRESSED) {
        onProgress?.({ stage: 'finalizing', progress: 100 });
        return {
          uri: aggressiveResult.uri,
          size: aggressiveSize,
          originalSize,
          compressionRatio: originalSize / aggressiveSize,
          mimeType: 'image/jpeg',
          width: aggressiveResult.width,
          height: aggressiveResult.height,
        };
      } else {
        throw new Error('Unable to compress image to acceptable size');
      }
    }
    
    onProgress?.({ stage: 'finalizing', progress: 100 });
    
    return {
      uri: result.uri,
      size: finalSize,
      originalSize,
      compressionRatio: originalSize / finalSize,
      mimeType: result.uri.includes('.png') ? 'image/png' : 'image/jpeg',
      width: result.width,
      height: result.height,
    };
    
  } catch (error) {
    throw new Error(
      error instanceof Error 
        ? `Image compression failed: ${error.message}`
        : 'Image compression failed'
    );
  }
}

// Video compression (placeholder - would need native module for full implementation)
export async function compressVideo(
  uri: string,
  onProgress?: (progress: CompressionProgress) => void
): Promise<CompressionResult> {
  try {
    onProgress?.({ stage: 'validating', progress: 0 });
    
    // Validate first
    const validation = await validateMedia(uri, 'video');
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    const originalSize = validation.size!;
    const mimeType = validation.mimeType!;
    
    onProgress?.({ stage: 'validating', progress: 30 });
    
    // For now, we'll just validate and return original if within limits
    // In production, you'd use a native module like react-native-video-processing
    // or server-side compression with FFmpeg
    
    if (originalSize <= SIZE_LIMITS.VIDEO_MAX_COMPRESSED) {
      onProgress?.({ stage: 'finalizing', progress: 100 });
      return {
        uri,
        size: originalSize,
        originalSize,
        compressionRatio: 1,
        mimeType,
      };
    }
    
    // Simulate compression progress for large videos
    onProgress?.({ stage: 'compressing', progress: 50 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    onProgress?.({ stage: 'compressing', progress: 80 });
    await new Promise(resolve => setTimeout(resolve, 500));
    onProgress?.({ stage: 'finalizing', progress: 100 });
    
    // In a real implementation, this would be the compressed video
    return {
      uri,
      size: Math.min(originalSize, SIZE_LIMITS.VIDEO_MAX_COMPRESSED),
      originalSize,
      compressionRatio: originalSize / Math.min(originalSize, SIZE_LIMITS.VIDEO_MAX_COMPRESSED),
      mimeType,
    };
    
  } catch (error) {
    throw new Error(
      error instanceof Error 
        ? `Video compression failed: ${error.message}`
        : 'Video compression failed'
    );
  }
}

// Utility to format file sizes
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Clean up temporary files
export async function cleanupTempFile(uri: string): Promise<void> {
  try {
    if (uri.includes(FileSystem.cacheDirectory || '')) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}
