import {
  cleanupTempFile,
  compressImage,
  CompressionProgress,
  CompressionResult,
  compressVideo,
  formatFileSize,
  SIZE_LIMITS
} from '@/lib/compression';
import { uploadPostAssetWithProgress } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { nanoid } from 'nanoid/non-secure';
import React, { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  Text,
  View
} from 'react-native';

// Types
export interface MediaItem {
  id: string;
  kind: 'image' | 'video';
  status: 'compressing' | 'uploading' | 'done' | 'error';
  localUri?: string;
  url?: string;
  error?: string;
  progress?: number;
  compressionInfo?: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  };
}

interface MediaUploaderState {
  images: MediaItem[];
  video: MediaItem | null;
  totalSize: number;
  hasInFlight: boolean;
  videoPickerLoading: boolean;
}

type MediaAction = 
  | { type: 'ADD_IMAGE'; payload: { id: string; localUri: string } }
  | { type: 'ADD_VIDEO'; payload: { id: string; localUri: string } }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<MediaItem> } }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'SET_VIDEO_PICKER_LOADING'; payload: { loading: boolean } }
  | { type: 'RESET' };

interface MediaUploaderProps {
  userId: string;
  maxImages?: number;
  maxVideos?: number;
  onMediaStateChange: (hasInFlight: boolean) => void;
  onMediaReady: (items: MediaItem[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  resetTrigger?: number; // Add reset trigger prop
}

// Reducer for complex state management
function mediaReducer(state: MediaUploaderState, action: MediaAction): MediaUploaderState {
  switch (action.type) {
    case 'ADD_IMAGE': {
      const newImage: MediaItem = {
        id: action.payload.id,
        kind: 'image',
        status: 'compressing',
        localUri: action.payload.localUri,
        progress: 0,
      };
      
      const newImages = [...state.images, newImage];
      const hasInFlight = true;
      
      return {
        ...state,
        images: newImages,
        hasInFlight,
      };
    }
    
    case 'ADD_VIDEO': {
      const newVideo: MediaItem = {
        id: action.payload.id,
        kind: 'video',
        status: 'compressing',
        localUri: action.payload.localUri,
        progress: 0,
      };
      
      return {
        ...state,
        video: newVideo,
        hasInFlight: true,
        videoPickerLoading: false,
      };
    }
    
    case 'SET_VIDEO_PICKER_LOADING': {
      return {
        ...state,
        videoPickerLoading: action.payload.loading,
        hasInFlight: state.hasInFlight || action.payload.loading,
      };
    }
    
    case 'UPDATE_ITEM': {
      const { id, updates } = action.payload;
      let newState = { ...state };
      
      // Update image
      const imageIndex = state.images.findIndex(img => img.id === id);
      if (imageIndex !== -1) {
        newState.images = [...state.images];
        newState.images[imageIndex] = { ...newState.images[imageIndex], ...updates };
      }
      
      // Update video
      if (state.video?.id === id) {
        newState.video = { ...state.video, ...updates };
      }
      
      // Recalculate hasInFlight and totalSize
      const allItems = [...newState.images, ...(newState.video ? [newState.video] : [])];
      newState.hasInFlight = newState.videoPickerLoading || allItems.some(item => 
        item.status === 'compressing' || item.status === 'uploading'
      );
      
      newState.totalSize = allItems.reduce((total, item) => {
        return total + (item.compressionInfo?.compressedSize || 0);
      }, 0);
      
      return newState;
    }
    
    case 'REMOVE_ITEM': {
      const { id } = action.payload;
      let newState = { ...state };
      
      // Remove image
      newState.images = state.images.filter(img => img.id !== id);
      
      // Remove video
      if (state.video?.id === id) {
        newState.video = null;
      }
      
      // Recalculate state
      const allItems = [...newState.images, ...(newState.video ? [newState.video] : [])];
      newState.hasInFlight = newState.videoPickerLoading || allItems.some(item => 
        item.status === 'compressing' || item.status === 'uploading'
      );
      
      newState.totalSize = allItems.reduce((total, item) => {
        return total + (item.compressionInfo?.compressedSize || 0);
      }, 0);
      
      return newState;
    }
    
    case 'RESET': {
      return {
        images: [],
        video: null,
        totalSize: 0,
        hasInFlight: false,
        videoPickerLoading: false,
      };
    }
    
    default:
      return state;
  }
}

// Shimmer component for loading states
const Shimmer = React.memo(({ style }: { style: any }) => {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[{ backgroundColor: '#e5e7eb' }, style, { opacity }]} />
  );
});


// Main MediaUploader component
export default function MediaUploader({
  userId,
  maxImages = 5,
  maxVideos = 1,
  onMediaStateChange,
  onMediaReady,
  onError,
  disabled = false,
  resetTrigger = 0,
}: MediaUploaderProps) {
  const isFocused = useIsFocused();
  const [state, dispatch] = useReducer(mediaReducer, {
    images: [],
    video: null,
    totalSize: 0,
    hasInFlight: false,
    videoPickerLoading: false,
  });
  
  // Cleanup refs for memory management
  const cleanupRefs = useRef<Set<string>>(new Set());
  
  // Reset media state when resetTrigger changes
  useEffect(() => {
    if (resetTrigger > 0) {
      // Cleanup all temp files
      cleanupRefs.current.forEach(uri => {
        cleanupTempFile(uri).catch(() => {});
      });
      cleanupRefs.current.clear();
      
      // Reset state
      dispatch({ type: 'RESET' });
    }
  }, [resetTrigger]);
  
  // Notify parent of state changes
  useEffect(() => {
    onMediaStateChange(state.hasInFlight);
  }, [state.hasInFlight, onMediaStateChange]);
  
  // Notify parent of ready media
  useEffect(() => {
    const readyItems = [
      ...state.images.filter(img => img.status === 'done'),
      ...(state.video && state.video.status === 'done' ? [state.video] : [])
    ];
    onMediaReady(readyItems);
  }, [state.images, state.video, onMediaReady]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRefs.current.forEach(uri => {
        cleanupTempFile(uri).catch(() => {});
      });
    };
  }, []);
  
  // Compress and upload media item
  const processMediaItem = useCallback(async (
    id: string, 
    localUri: string, 
    kind: 'image' | 'video'
  ) => {
    try {
      // Add to cleanup refs
      cleanupRefs.current.add(localUri);
      
      // Compression phase
      dispatch({ 
        type: 'UPDATE_ITEM', 
        payload: { id, updates: { status: 'compressing', progress: 0 } } 
      });
      
      const onProgress = (progress: CompressionProgress) => {
        const progressPercent = Math.round(progress.progress);
        dispatch({ 
          type: 'UPDATE_ITEM', 
          payload: { 
            id, 
            updates: { 
              progress: progressPercent,
              status: 'compressing'
            } 
          } 
        });
      };
      
      let compressionResult: CompressionResult;
      if (kind === 'image') {
        compressionResult = await compressImage(localUri, onProgress);
      } else {
        compressionResult = await compressVideo(localUri, onProgress);
      }
      
      // Check total size limit
      const projectedTotalSize = state.totalSize + compressionResult.size;
      if (projectedTotalSize > SIZE_LIMITS.TOTAL_MEDIA_LIMIT) {
        throw new Error(`Total media size would exceed ${formatFileSize(SIZE_LIMITS.TOTAL_MEDIA_LIMIT)} limit`);
      }
      
      // Upload phase
      dispatch({ 
        type: 'UPDATE_ITEM', 
        payload: { 
          id, 
          updates: { 
            status: 'uploading', 
            progress: 0,
            compressionInfo: {
              originalSize: compressionResult.originalSize,
              compressedSize: compressionResult.size,
              compressionRatio: compressionResult.compressionRatio,
            }
          } 
        } 
      });
      
      const uploadResult = await uploadPostAssetWithProgress(
        userId,
        compressionResult.uri,
        Date.now(),
        (pct) => {
          dispatch({ 
            type: 'UPDATE_ITEM', 
            payload: { id, updates: { progress: Math.round(pct) } } 
          });
        }
      );
      
      // Success
      dispatch({ 
        type: 'UPDATE_ITEM', 
        payload: { 
          id, 
          updates: { 
            status: 'done', 
            url: uploadResult.url, 
            progress: 100 
          } 
        } 
      });
      
      // Cleanup compressed file if different from original
      if (compressionResult.uri !== localUri) {
        cleanupTempFile(compressionResult.uri).catch(() => {});
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      dispatch({ 
        type: 'UPDATE_ITEM', 
        payload: { 
          id, 
          updates: { 
            status: 'error', 
            error: errorMessage,
            progress: 0 
          } 
        } 
      });
      
      onError?.(errorMessage);
      
      Alert.alert(
        'Upload Failed',
        errorMessage,
        [
          { text: 'Remove', onPress: () => removeItem(id) },
          { text: 'Retry', onPress: () => processMediaItem(id, localUri, kind) },
        ]
      );
    }
  }, [userId, state.totalSize, onError]);
  
  // Add images
  const addImages = useCallback(async () => {
    if (disabled || state.images.length >= maxImages) {
      Alert.alert('Limit reached', `You can add up to ${maxImages} images.`);
      return;
    }
    
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo library access');
        return;
      }
      
      const remainingSlots = maxImages - state.images.length;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1, // Get highest quality for compression
        selectionLimit: remainingSlots,
      });
      
      if (result.canceled) return;
      
      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Sign in required', 'Please sign in to upload media');
        return;
      }
      
      // Add images to state immediately (shows shimmer)
      const newImages = result.assets.slice(0, remainingSlots).map(asset => ({
        id: nanoid(),
        localUri: asset.uri,
      }));
      
      newImages.forEach(({ id, localUri }) => {
        dispatch({ type: 'ADD_IMAGE', payload: { id, localUri } });
        // Start processing immediately
        processMediaItem(id, localUri, 'image');
      });
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to pick images';
      onError?.(message);
      Alert.alert('Error', message);
    }
  }, [disabled, state.images.length, maxImages, processMediaItem, onError]);
  
  // Add video
  const addVideo = useCallback(async () => {
    if (disabled || state.video || state.videoPickerLoading) {
      if (state.video) {
        Alert.alert('Limit reached', `Only ${maxVideos} video is allowed.`);
      }
      return;
    }
    
    try {
      // Show "Video added" immediately
      dispatch({ type: 'SET_VIDEO_PICKER_LOADING', payload: { loading: true } });
      
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        dispatch({ type: 'SET_VIDEO_PICKER_LOADING', payload: { loading: false } });
        Alert.alert('Permission needed', 'Please grant photo library access');
        return;
      }
      
      // Optimized picker configuration for better performance
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: false,
        quality: 0.8, // Slightly lower quality for faster picker performance
        videoMaxDuration: 300, // 5 minutes max to improve picker speed
        allowsEditing: false, // Disable editing for faster picker
      });
      
      if (result.canceled) {
        // Revert to regular state if user cancels
        dispatch({ type: 'SET_VIDEO_PICKER_LOADING', payload: { loading: false } });
        return;
      }
      
      const id = nanoid();
      const localUri = result.assets[0].uri;
      
      // Add video to state (this will clear the loading state)
      dispatch({ type: 'ADD_VIDEO', payload: { id, localUri } });
      
      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        dispatch({ type: 'REMOVE_ITEM', payload: { id } });
        Alert.alert('Sign in required', 'Please sign in to upload media');
        return;
      }
      
      // Start processing immediately
      processMediaItem(id, localUri, 'video');
      
    } catch (error) {
      // Revert to regular state on error
      dispatch({ type: 'SET_VIDEO_PICKER_LOADING', payload: { loading: false } });
      const message = error instanceof Error ? error.message : 'Failed to pick video';
      onError?.(message);
      Alert.alert('Error', message);
    }
  }, [disabled, state.video, state.videoPickerLoading, maxVideos, processMediaItem, onError]);
  
  // Remove item
  const removeItem = useCallback((id: string) => {
    const item = [...state.images, ...(state.video ? [state.video] : [])].find(i => i.id === id);
    if (item?.localUri) {
      cleanupTempFile(item.localUri).catch(() => {});
      cleanupRefs.current.delete(item.localUri);
    }
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  }, [state.images, state.video]);
  
  
  // Render image item
  const renderImageItem = useCallback((item: MediaItem) => {
    if (item.status === 'compressing' || item.status === 'uploading') {
      return (
        <View key={item.id} style={styles.mediaItem}>
          <Shimmer style={styles.mediaImage} />
          <Pressable
            onPress={() => removeItem(item.id)}
            style={styles.removeButton}
          >
            <Text style={styles.removeButtonText}>×</Text>
          </Pressable>
        </View>
      );
    }
    
    if (item.status === 'error') {
      return (
        <View key={item.id} style={[styles.mediaItem, styles.errorItem]}>
          <View style={styles.errorPlaceholder}>
            <Text style={styles.errorText}>Failed</Text>
          </View>
          <Text style={styles.errorMessage}>{item.error}</Text>
          <View style={styles.errorActions}>
            <Pressable
              onPress={() => processMediaItem(item.id, item.localUri || '', 'image')}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
            <Pressable
              onPress={() => removeItem(item.id)}
              style={styles.removeButton}
            >
              <Text style={styles.removeButtonText}>×</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    
    // Done state
    return (
      <View key={item.id} style={styles.mediaItem}>
        <Image source={{ uri: item.url }} style={styles.mediaImage} />
        <Pressable
          onPress={() => removeItem(item.id)}
          style={styles.removeButton}
        >
          <Text style={styles.removeButtonText}>×</Text>
        </Pressable>
      </View>
    );
  }, [removeItem, processMediaItem]);
  
  // Render video item
  const renderVideoItem = useCallback((item: MediaItem) => {
    if (item.status === 'compressing' || item.status === 'uploading') {
      return (
        <View style={styles.videoContainer}>
          <View style={styles.videoHeader}>
            <Text style={styles.videoLabel}>
              Video - {item.status === 'compressing' ? 'Compressing' : 'Uploading'} {item.progress || 0}%
            </Text>
            <Pressable onPress={() => removeItem(item.id)}>
              <Text style={styles.removeVideoText}>Cancel</Text>
            </Pressable>
          </View>
          <View style={styles.videoPlaceholder}>
            <Shimmer style={styles.videoPlaceholder} />
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${item.progress || 0}%` }]} />
              </View>
            </View>
          </View>
        </View>
      );
    }
    
    if (item.status === 'error') {
      return (
        <View style={styles.videoContainer}>
          <Text style={styles.videoLabel}>Video - Failed</Text>
          <View style={styles.errorPlaceholder}>
            <Text style={styles.errorText}>Upload Failed</Text>
          </View>
          <Text style={styles.errorMessage}>{item.error}</Text>
          <View style={styles.errorActions}>
            <Pressable
              onPress={() => processMediaItem(item.id, item.localUri || '', 'video')}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
            <Pressable onPress={() => removeItem(item.id)}>
              <Text style={styles.removeVideoText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    
    // Done state
    return (
      <View style={styles.videoContainer}>
        <Text style={styles.videoLabel}>Video</Text>
        {isFocused ? (
          <Video
            source={{ uri: item.url || '' }}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            style={styles.video}
          />
        ) : (
          <View style={styles.videoPaused}>
            <Text style={{ color: '#64748b', fontWeight: '500' }}>Video paused</Text>
          </View>
        )}
        <Pressable onPress={() => removeItem(item.id)}>
          <Text style={styles.removeVideoText}>Remove video</Text>
        </Pressable>
      </View>
    );
  }, [removeItem, processMediaItem, isFocused]);
  
  return (
    <View style={styles.container}>
      {/* Media Pickers */}
      <View style={styles.pickerContainer}>
        <Pressable
          onPress={addImages}
          disabled={disabled || state.images.length >= maxImages}
          style={({ pressed }) => [
            styles.pickerButton,
            { opacity: pressed || disabled || state.images.length >= maxImages ? 0.6 : 1 }
          ]}
        >
          <Text style={styles.pickerButtonText}>
            Add images ({state.images.length}/{maxImages})
          </Text>
        </Pressable>

        <Pressable
          onPress={addVideo}
          disabled={disabled || !!state.video || state.videoPickerLoading}
          style={({ pressed }) => [
            styles.pickerButton,
            { opacity: pressed || disabled || !!state.video || state.videoPickerLoading ? 0.6 : 1 }
          ]}
        >
          <Text style={styles.pickerButtonText}>
            {state.videoPickerLoading || state.video ? 'Video added' : `Add video (${maxVideos})`}
          </Text>
        </Pressable>
      </View>


      {/* Images Display */}
      {state.images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mediaScroll}
        >
          {state.images.map(renderImageItem)}
        </ScrollView>
      )}

      {/* Video Picker Loading State */}
      {state.videoPickerLoading && (
        <View style={styles.videoContainer}>
          <Text style={styles.videoLabel}>Video added</Text>
          <View style={styles.videoPlaceholder}>
            <Shimmer style={styles.videoPlaceholder} />
          </View>
        </View>
      )}

      {/* Video Display */}
      {state.video && renderVideoItem(state.video)}

    </View>
  );
}

// Styles
const styles = {
  container: {
    gap: 12,
  },
  
  // Pickers
  pickerContainer: { 
    flexDirection: 'row' as const, 
    gap: 8 
  },
  pickerButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center' as const,
  },
  pickerButtonText: { 
    fontWeight: '700' as const,
    fontSize: 14,
  },
  
  // Size indicator
  sizeIndicator: {
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  sizeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600' as const,
  },
  
  // Media scroll
  mediaScroll: { 
    gap: 8,
    paddingHorizontal: 2,
  },
  
  // Media items
  mediaItem: { 
    position: 'relative' as const,
    marginBottom: 8,
  },
  mediaImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  
  // Progress
  progressContainer: {
    position: 'absolute' as const,
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    padding: 4,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%' as const,
    backgroundColor: '#3b82f6',
  },
  progressText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center' as const,
    marginTop: 2,
  },
  
  // Remove button
  removeButton: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  removeButtonText: { 
    color: '#fff', 
    fontWeight: '800' as const,
    fontSize: 16,
  },
  
  // Error states
  errorItem: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  errorPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#dc2626',
    fontWeight: '600' as const,
    fontSize: 12,
  },
  errorMessage: {
    color: '#dc2626',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center' as const,
  },
  errorActions: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 4,
    justifyContent: 'center' as const,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600' as const,
  },
  
  // Video
  videoContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  videoHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  videoLabel: { 
    fontWeight: '700' as const,
    fontSize: 14,
  },
  videoPlaceholder: { 
    width: '100%' as const, 
    height: 180, 
    borderRadius: 10 
  },
  video: { 
    width: '100%' as const, 
    height: 180, 
    borderRadius: 10 
  },
  videoPaused: {
    width: '100%' as const,
    height: 180,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  removeVideoText: { 
    color: '#ef4444', 
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
};
