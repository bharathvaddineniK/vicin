import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Post, PostType } from './usePosts';

interface UseFeedPostsOptions {
  category: PostType;
  pageSize?: number;
  userLocation?: { lat: number; lng: number };
}

interface FeedState {
  posts: Post[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  newPostsCount: number;
  lastFetchTime: Date;
}

export function useFeedPosts({ category, pageSize = 10, userLocation }: UseFeedPostsOptions) {
  const [state, setState] = useState<FeedState>({
    posts: [],
    loading: true,
    loadingMore: false,
    error: null,
    hasMore: true,
    newPostsCount: 0,
    lastFetchTime: new Date(),
  });

  const currentPageRef = useRef(0);
  const lastPostIdRef = useRef<string | null>(null);
  const newPostsCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch posts with pagination
  const fetchPosts = useCallback(async (page: number = 0, append: boolean = false) => {
    try {
      if (!append) {
        setState(prev => ({ ...prev, loading: true, error: null }));
      } else {
        setState(prev => ({ ...prev, loadingMore: true, error: null }));
      }

      let query = supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey (
            id,
            handle,
            display_name,
            avatar_url,
            verified,
            home_location
          ),
          post_likes (
            user_id,
            created_at
          ),
          post_comments (
            id,
            body,
            created_at,
            author_id
          ),
          post_media (
            id,
            kind,
            url,
            created_at
          )
        `)
        .eq('post_type', category)
        .eq('is_deleted', false)
        .eq('status', 'active')
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Add location filtering if available
      if (userLocation) {
        // Note: In production, you'd use PostGIS ST_DWithin for proper location filtering
        // For now, we'll fetch all and filter client-side or implement a simpler approach
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const newPosts = data || [];
      const hasMore = newPosts.length === pageSize;

      setState(prev => ({
        ...prev,
        posts: append ? [...prev.posts, ...newPosts] : newPosts,
        loading: false,
        loadingMore: false,
        hasMore,
        lastFetchTime: new Date(),
      }));

      // Update refs
      currentPageRef.current = page;
      if (newPosts.length > 0) {
        lastPostIdRef.current = newPosts[0].id;
      }

    } catch (err) {
      console.error('Error fetching posts:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        loadingMore: false,
        error: err instanceof Error ? err.message : 'Failed to fetch posts',
      }));
    }
  }, [category, pageSize, userLocation]);

  // Load more posts (pagination)
  const loadMore = useCallback(async () => {
    if (state.loadingMore || !state.hasMore) return;
    
    const nextPage = currentPageRef.current + 1;
    await fetchPosts(nextPage, true);
  }, [fetchPosts, state.loadingMore, state.hasMore]);

  // Check for new posts
  const checkForNewPosts = useCallback(async () => {
    if (!lastPostIdRef.current) return;

    try {
      const { count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('post_type', category)
        .eq('is_deleted', false)
        .eq('status', 'active')
        .or('expires_at.is.null,expires_at.gt.now()')
        .gt('created_at', state.lastFetchTime.toISOString());

      if (count && count > 0) {
        setState(prev => ({
          ...prev,
          newPostsCount: count,
        }));
      }
    } catch (error) {
      console.error('Error checking for new posts:', error);
    }
  }, [category, state.lastFetchTime]);

  // Load new posts and scroll to top
  const loadNewPosts = useCallback(async () => {
    setState(prev => ({ ...prev, newPostsCount: 0 }));
    currentPageRef.current = 0;
    await fetchPosts(0, false);
  }, [fetchPosts]);

  // Refresh feed
  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, newPostsCount: 0 }));
    currentPageRef.current = 0;
    await fetchPosts(0, false);
  }, [fetchPosts]);

  // Optimistic like update
  const updatePostLike = useCallback((postId: string, isLiked: boolean) => {
    setState(prev => ({
      ...prev,
      posts: prev.posts.map(post => {
        if (post.id === postId) {
          const currentLikes = post.post_likes || [];
          const newLikes = isLiked 
            ? [...currentLikes, { user_id: 'current-user-id', created_at: new Date().toISOString() }]
            : currentLikes.filter(like => like.user_id !== 'current-user-id');
          
          return {
            ...post,
            post_likes: newLikes,
          };
        }
        return post;
      }),
    }));
  }, []);

  // Initial load
  useEffect(() => {
    fetchPosts(0, false);
  }, [fetchPosts]);

  // Set up periodic check for new posts
  useEffect(() => {
    // Check for new posts every 30 seconds
    newPostsCheckIntervalRef.current = setInterval(checkForNewPosts, 30000);

    return () => {
      if (newPostsCheckIntervalRef.current) {
        clearInterval(newPostsCheckIntervalRef.current);
      }
    };
  }, [checkForNewPosts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (newPostsCheckIntervalRef.current) {
        clearInterval(newPostsCheckIntervalRef.current);
      }
    };
  }, []);

  return {
    posts: state.posts,
    loading: state.loading,
    loadingMore: state.loadingMore,
    error: state.error,
    hasMore: state.hasMore,
    newPostsCount: state.newPostsCount,
    loadMore,
    loadNewPosts,
    refresh,
    updatePostLike,
  };
}

// Hook for getting user's current location
export function useUserLocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentLocation = async () => {
      try {
        // Request location permission and get current position
        // This is a placeholder - in a real app, you'd use expo-location
        // For now, we'll use a default location
        setLocation({ lat: 40.7128, lng: -74.0060 }); // NYC
        setLoading(false);
      } catch (err) {
        console.error('Error getting location:', err);
        setError(err instanceof Error ? err.message : 'Failed to get location');
        setLoading(false);
      }
    };

    getCurrentLocation();
  }, []);

  return { location, loading, error };
}
