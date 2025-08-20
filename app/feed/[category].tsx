import PostCard from "@/components/PostCard";
import { useFeedPosts, useUserLocation } from "@/hooks/useFeedPosts";
import { PostType } from "@/hooks/usePosts";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ArrowUp, MagnifyingGlass, X } from "phosphor-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CATEGORY_TITLES: Record<PostType, string> = {
  update: "Community Updates",
  question: "Questions",
  help: "Help Requests",
  offer: "Offers & Free Items",
  event: "Events",
  alert: "Alerts",
};

export default function CategoryFeed() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const feedCategory = category as PostType;
  
  const flatListRef = useRef<FlatList>(null);
  const newPostsBadgeAnim = useRef(new Animated.Value(0)).current;
  const [searchQuery, setSearchQuery] = useState("");
  
  // Get user location for distance calculations
  const { location: userLocation } = useUserLocation();
  
  // Feed data and functions
  const {
    posts,
    loading,
    loadingMore,
    error,
    hasMore,
    newPostsCount,
    loadMore,
    loadNewPosts,
    refresh,
    updatePostLike,
  } = useFeedPosts({
    category: feedCategory,
    pageSize: 10,
    userLocation: userLocation || undefined,
  });

  // Filter posts based on search query
  const filteredPosts = React.useMemo(() => {
    if (!searchQuery.trim()) return posts;
    return posts.filter(post => 
      post.content?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [posts, searchQuery]);

  // Animate new posts badge
  React.useEffect(() => {
    if (newPostsCount > 0) {
      Animated.spring(newPostsBadgeAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(newPostsBadgeAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [newPostsCount, newPostsBadgeAnim]);

  const handleLoadNewPosts = useCallback(() => {
    loadNewPosts();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [loadNewPosts]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loadingMore && !searchQuery.trim()) {
      loadMore();
    }
  }, [hasMore, loadingMore, loadMore, searchQuery]);

  const renderPost = useCallback(({ item, index }: { item: any; index: number }) => (
    <PostCard
      key={item.id}
      post={item}
      userLocation={userLocation || undefined}
      onLike={updatePostLike}
      onComment={(postId) => console.log('Comment on post:', postId)}
      onShare={(postId) => console.log('Share post:', postId)}
    />
  ), [userLocation, updatePostLike]);

  const renderLoadMoreButton = useCallback(() => {
    if (!hasMore || searchQuery.trim()) return null;

    return (
      <View style={styles.loadMoreContainer}>
        <Pressable
          onPress={loadMore}
          disabled={loadingMore}
          style={[styles.loadMoreButton, loadingMore && styles.loadMoreButtonDisabled]}
          accessibilityLabel="Load more posts"
          accessibilityRole="button"
        >
          {loadingMore ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.loadMoreText}>Load More</Text>
          )}
        </Pressable>
      </View>
    );
  }, [hasMore, loadMore, loadingMore, searchQuery]);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>
        {searchQuery.trim() ? "No matching posts" : "No posts yet"}
      </Text>
      <Text style={styles.emptyDescription}>
        {searchQuery.trim() 
          ? "Try adjusting your search terms"
          : "Be the first to share something in this category!"
        }
      </Text>
    </View>
  ), [searchQuery]);

  const renderErrorState = useCallback(() => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Unable to load posts</Text>
      <Text style={styles.errorDescription}>{error || 'An error occurred'}</Text>
      <Pressable
        onPress={refresh}
        style={styles.retryButton}
        accessibilityLabel="Retry loading posts"
        accessibilityRole="button"
      >
        <Text style={styles.retryText}>Try Again</Text>
      </Pressable>
    </View>
  ), [error, refresh]);

  if (!feedCategory || !CATEGORY_TITLES[feedCategory]) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Invalid Category</Text>
          <Text style={styles.errorDescription}>
            The requested category does not exist.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={styles.retryButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Clean Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ArrowLeft size={24} color="#000" weight="regular" />
        </Pressable>
        
        <Text style={styles.title}>{CATEGORY_TITLES[feedCategory]}</Text>
        
        <View style={styles.spacer} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <MagnifyingGlass size={20} color="#666" weight="regular" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search posts..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => setSearchQuery("")}
            style={styles.clearButton}
            accessibilityLabel="Clear search"
            accessibilityRole="button"
          >
            <X size={18} color="#666" weight="regular" />
          </Pressable>
        )}
      </View>

      {/* New Posts Badge */}
      <Animated.View
        style={[
          styles.newPostsBadge,
          {
            transform: [
              {
                translateY: newPostsBadgeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-60, 0],
                }),
              },
              {
                scale: newPostsBadgeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
            opacity: newPostsBadgeAnim,
          },
        ]}
        pointerEvents={newPostsCount > 0 ? "auto" : "none"}
      >
        <Pressable
          onPress={handleLoadNewPosts}
          style={styles.newPostsButton}
          accessibilityLabel={`${newPostsCount} new posts available. Tap to load.`}
          accessibilityRole="button"
        >
          <ArrowUp size={16} color="#FFFFFF" weight="bold" />
          <Text style={styles.newPostsText}>
            {`${newPostsCount} new post${newPostsCount !== 1 ? 's' : ''}`}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Animated.spring(newPostsBadgeAnim, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }}
          style={styles.dismissButton}
          accessibilityLabel="Dismiss new posts notification"
          accessibilityRole="button"
        >
          <X size={14} color="#666" weight="bold" />
        </Pressable>
      </Animated.View>

      {/* Content */}
      {loading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : error && posts.length === 0 ? (
        renderErrorState()
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredPosts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={loading && posts.length > 0}
              onRefresh={refresh}
              colors={["#007AFF"]}
              tintColor="#007AFF"
            />
          }
          ListEmptyComponent={filteredPosts.length === 0 && !loading ? renderEmptyState : null}
          ListFooterComponent={renderLoadMoreButton}
          removeClippedSubviews={true}
          maxToRenderPerBatch={5}
          windowSize={10}
          initialNumToRender={5}
          getItemLayout={(data, index) => ({
            length: 200, // Approximate item height
            offset: 200 * index,
            index,
          })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    flex: 1,
    textAlign: "center",
    marginRight: 40, // Offset for back button
  },
  spacer: {
    width: 40,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  newPostsBadge: {
    position: "absolute",
    top: 120,
    left: 16,
    right: 16,
    zIndex: 1000,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    borderRadius: 8,
    overflow: "hidden",
  },
  newPostsButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  newPostsText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  dismissButton: {
    padding: 12,
    backgroundColor: "#F0F0F0",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF3B30",
    textAlign: "center",
  },
  errorDescription: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 100,
  },
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  loadMoreButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
  },
  loadMoreButtonDisabled: {
    opacity: 0.6,
  },
  loadMoreText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
