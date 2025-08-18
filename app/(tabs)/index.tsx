// /app/(tabs)/index.tsx
import Screen from "@/components/Screen";
import { supabase } from "@/lib/supabase";
import { useIsFocused } from "@react-navigation/native";
import { AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Text,
  View,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MediaRow = { url: string; kind: "image" | "video" };
type FeedPost = {
  id: string;
  content: string;
  post_type: string | null;
  created_at: string;
  expires_at: string | null;
  post_media: MediaRow[]; // ← joined rows
};

// Memory-optimized video component
const VideoComponent = React.memo(({ 
  video, 
  isVisible, 
  isFocused 
}: { 
  video: MediaRow; 
  isVisible: boolean;
  isFocused: boolean;
}) => {
  const videoRef = useRef<Video>(null);
  
  useEffect(() => {
    if (!isVisible || !isFocused) {
      // Pause and unload video when not visible or screen not focused
      videoRef.current?.pauseAsync();
      videoRef.current?.unloadAsync();
    }
  }, [isVisible, isFocused]);
  
  // Don't render video component if not visible to save memory
  if (!isVisible || !isFocused) {
    return (
      <View
        style={{
          width: "100%",
          height: 200,
          borderRadius: 12,
          backgroundColor: "#f1f5f9",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#64748b" }}>Video paused</Text>
      </View>
    );
  }
  
  return (
    <Video
      ref={videoRef}
      source={{ uri: video.url }}
      useNativeControls
      resizeMode={ResizeMode.COVER}
      shouldPlay={false} // Don't auto-play to save bandwidth and battery
      style={{
        width: "100%",
        height: 200,
        borderRadius: 12,
        backgroundColor: "#000",
      }}
      onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
        // Handle playback errors gracefully
        if (!status.isLoaded && status.error) {
          console.warn("Video playback error:", status.error);
        }
      }}
    />
  );
});

// Optimized post item component
const PostItem = React.memo(({ 
  item, 
  isVisible, 
  isFocused 
}: { 
  item: FeedPost; 
  isVisible: boolean;
  isFocused: boolean;
}) => {
  const images = useMemo(
    () => item.post_media?.filter((m) => m.kind === "image") ?? [],
    [item.post_media]
  );
  
  const video = useMemo(
    () => item.post_media?.find((m) => m.kind === "video") ?? null,
    [item.post_media]
  );
  
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: "#e5e7eb",
      }}
    >
      <Text style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
        {(item.post_type ?? "update").toUpperCase()}
      </Text>
      <Text style={{ color: "#111827" }}>{item.content}</Text>

      {/* images */}
      {images.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginTop: 10,
            flexWrap: "wrap",
          }}
        >
          {images.map((m, i) => (
            <Image
              key={m.url + i}
              source={{ uri: m.url }}
              style={{
                width: 104,
                height: 104,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#e5e7eb",
              }}
              // Add loading optimization
              loadingIndicatorSource={{ uri: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' }}
            />
          ))}
        </View>
      )}

      {/* video */}
      {video && (
        <View style={{ marginTop: 10 }}>
          <VideoComponent 
            video={video} 
            isVisible={isVisible} 
            isFocused={isFocused}
          />
        </View>
      )}

      <Text style={{ color: "#94a3b8", marginTop: 8, fontSize: 12 }}>
        {new Date(item.created_at).toLocaleString()}
      </Text>
    </View>
  );
});

const POSTS_PER_PAGE = 20; // Reduced from 50 to improve performance

export default function HomeFeed() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  
  const isFocused = useIsFocused();
  const channelRef = useRef<any>(null);
  
  // Track visible items for video optimization
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visibleIds = new Set(viewableItems.map(item => item.item.id));
    setVisibleItems(visibleIds);
  }, []);
  
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50, // Item must be 50% visible
    minimumViewTime: 100, // Must be visible for 100ms
  }), []);

  const loadInitialPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, content, post_type, created_at, expires_at, post_media(url,kind)",
        )
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(POSTS_PER_PAGE);

      if (!error && data) {
        setPosts(data as unknown as FeedPost[]);
        setHasMore(data.length === POSTS_PER_PAGE);
      }
    } catch (error) {
      console.error("Error loading posts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore || posts.length === 0) return;
    
    setLoadingMore(true);
    try {
      const lastPost = posts[posts.length - 1];
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, content, post_type, created_at, expires_at, post_media(url,kind)",
        )
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .lt("created_at", lastPost.created_at)
        .limit(POSTS_PER_PAGE);

      if (!error && data) {
        setPosts(prev => [...prev, ...(data as unknown as FeedPost[])]);
        setHasMore(data.length === POSTS_PER_PAGE);
      }
    } catch (error) {
      console.error("Error loading more posts:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, posts]);

  useEffect(() => {
    let mounted = true;
    
    const setupFeed = async () => {
      // Check Supabase connection and auth status first
      try {
        console.log('Checking Supabase connection...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('Current session:', session ? 'authenticated' : 'not authenticated');
        if (sessionError) {
          console.error('Session error:', sessionError);
        }
        
        // Test basic connection with a simple query
        const { data: testData, error: testError } = await supabase
          .from('posts')
          .select('count')
          .limit(1);
        
        if (testError) {
          console.error('Supabase connection test failed:', testError);
        } else {
          console.log('Supabase connection test successful');
        }
      } catch (error) {
        console.error('Error testing Supabase connection:', error);
      }
      
      await loadInitialPosts();
      
      if (!mounted) return;
      
      // Only set up real-time subscription if we have a valid session or are guest
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session found, skipping real-time subscription');
        return;
      }
      
      // Set up real-time subscription with better error handling
      const setupSubscription = async (retryCount = 0) => {
        try {
          console.log(`Setting up subscription (attempt ${retryCount + 1})`);
          
          channelRef.current = supabase
            .channel(`posts-feed-${Date.now()}`) // Unique channel name
            .on(
              "postgres_changes",
              { 
                event: "INSERT", 
                schema: "public", 
                table: "posts",
                filter: "is_deleted=eq.false" // Only listen for non-deleted posts
              },
              (payload) => {
                console.log('Real-time update received:', payload);
                if (mounted) {
                  setPosts((p) => [{ ...(payload.new as any), post_media: [] }, ...p]);
                }
              },
            )
            .subscribe((status) => {
              console.log('Feed subscription status:', status);
              if (status === 'SUBSCRIBED') {
                console.log('✅ Feed subscription active');
              } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ Feed subscription error');
                // Stop retrying after 2 attempts to avoid infinite loops
                if (retryCount < 2 && mounted) {
                  setTimeout(() => {
                    if (channelRef.current) {
                      supabase.removeChannel(channelRef.current);
                      channelRef.current = null;
                    }
                    setupSubscription(retryCount + 1);
                  }, 3000 * (retryCount + 1)); // Longer delays
                } else {
                  console.log('Max retries reached, giving up on real-time subscription');
                }
              } else if (status === 'CLOSED') {
                console.log('Feed subscription closed');
              } else if (status === 'TIMED_OUT') {
                console.log('Feed subscription timed out');
                if (retryCount < 2 && mounted) {
                  setTimeout(() => {
                    if (channelRef.current) {
                      supabase.removeChannel(channelRef.current);
                      channelRef.current = null;
                    }
                    setupSubscription(retryCount + 1);
                  }, 5000);
                }
              }
            });
        } catch (error) {
          console.error("Error setting up real-time subscription:", error);
          // Only retry on error if we haven't exceeded retry limit
          if (retryCount < 2 && mounted) {
            setTimeout(() => setupSubscription(retryCount + 1), 3000 * (retryCount + 1));
          }
        }
      };
      
      setupSubscription();
    };
    
    setupFeed();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [loadInitialPosts]);
  
  // Cleanup videos when screen loses focus
  useEffect(() => {
    if (!isFocused) {
      setVisibleItems(new Set());
    }
  }, [isFocused]);

  const renderItem = useCallback(({ item }: { item: FeedPost }) => (
    <PostItem 
      item={item} 
      isVisible={visibleItems.has(item.id)} 
      isFocused={isFocused}
    />
  ), [visibleItems, isFocused]);

  const keyExtractor = useCallback((item: FeedPost) => item.id, []);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={{ padding: 20, alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }, [loadingMore]);

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!posts.length) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: "#64748b" }}>No posts yet. Be the first!</Text>
      </SafeAreaView>
    );
  }

  const Content = (
    <Screen edges={["top"]}>
      <FlatList
        contentContainerStyle={{ padding: 12, gap: 10 }}
        data={posts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
        getItemLayout={undefined} // Let FlatList calculate automatically for variable heights
      />
    </Screen>
  )

  return Platform.OS === "android" ? (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
      {Content}
    </SafeAreaView>
  ) : (
    Content
  );
}
