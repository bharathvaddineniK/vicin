import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export type PostType = 'update' | 'question' | 'help' | 'offer' | 'event' | 'alert';

export interface Post {
  id: string;
  author_id: string;
  type: PostType;
  content: string;
  post_type: PostType;
  status: 'active' | 'hidden' | 'removed' | 'expired';
  created_at: string;
  updated_at: string;
  expires_at?: string;
  tags: string[];
  call_enabled: boolean;
  venue_label?: string;
  location: any; // PostGIS geography type
  venue_location?: any;
  visibility_radius_m: number;
  location_source: 'subject' | 'venue';
  is_deleted: boolean;
  // Relations
  author?: {
    id: string;
    handle?: string;
    display_name?: string;
    avatar_url?: string;
    verified: boolean;
    home_location?: any; // PostGIS geography type for user's home location
  };
  post_likes?: Array<{
    user_id: string;
    created_at: string;
  }>;
  post_comments?: Array<{
    id: string;
    body: string;
    created_at: string;
    author_id: string;
  }>;
  post_media?: Array<{
    id: string;
    kind: 'image' | 'video';
    url: string;
    created_at: string;
  }>;
}

export interface PostStats {
  totalPosts: number;
  postsByType: Record<PostType, number>;
  recentPosts: number;
  nearbyPosts: number;
  expiringPosts: number;
  trendingPosts: Post[];
}

export function usePosts(options?: {
  limit?: number;
  type?: PostType;
  nearLocation?: { lat: number; lng: number; radiusM?: number };
  includeExpired?: boolean;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, [options?.limit, options?.type, options?.nearLocation, options?.includeExpired]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);

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
        .eq('is_deleted', false)
        .eq('status', 'active');

      // Filter by type if specified
      if (options?.type) {
        query = query.eq('post_type', options.type);
      }

      // Filter by expiration if not including expired
      if (!options?.includeExpired) {
        query = query.or('expires_at.is.null,expires_at.gt.now()');
      }

      // Add location filtering if specified
      if (options?.nearLocation) {
        const { lat, lng, radiusM = 8047 } = options.nearLocation;
        // Note: This is a simplified location query. In production, you'd use PostGIS functions
        // For now, we'll fetch all and filter client-side or use a simpler approach
      }

      // Order by creation date (most recent first)
      query = query.order('created_at', { ascending: false });

      // Apply limit
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setPosts(data || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  return {
    posts,
    loading,
    error,
    refetch: fetchPosts,
  };
}

export function usePostStats(nearLocation?: { lat: number; lng: number; radiusM?: number }) {
  const [stats, setStats] = useState<PostStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [nearLocation]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch basic post counts by type
      const { data: postCounts, error: countsError } = await supabase
        .from('posts')
        .select('post_type')
        .eq('is_deleted', false)
        .eq('status', 'active');

      if (countsError) throw countsError;

      // Count posts by type
      const postsByType: Record<PostType, number> = {
        update: 0,
        question: 0,
        help: 0,
        offer: 0,
        event: 0,
        alert: 0,
      };

      postCounts?.forEach(post => {
        if (post.post_type in postsByType) {
          postsByType[post.post_type as PostType]++;
        }
      });

      // Fetch recent posts (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: recentCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('status', 'active')
        .gte('created_at', sevenDaysAgo.toISOString());

      // Fetch expiring posts (expire within 24 hours)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { count: expiringCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('status', 'active')
        .not('expires_at', 'is', null)
        .lte('expires_at', tomorrow.toISOString());

      // Fetch trending posts (most liked/commented in last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: trendingPosts, error: trendingError } = await supabase
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
            created_at
          )
        `)
        .eq('is_deleted', false)
        .eq('status', 'active')
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (trendingError) throw trendingError;

      // Sort by engagement (likes + comments)
      const sortedTrending = (trendingPosts || []).sort((a, b) => {
        const aEngagement = (a.post_likes?.length || 0) + (a.post_comments?.length || 0);
        const bEngagement = (b.post_likes?.length || 0) + (b.post_comments?.length || 0);
        return bEngagement - aEngagement;
      });

      setStats({
        totalPosts: postCounts?.length || 0,
        postsByType,
        recentPosts: recentCount || 0,
        nearbyPosts: 0, // TODO: Implement location-based counting
        expiringPosts: expiringCount || 0,
        trendingPosts: sortedTrending.slice(0, 5),
      });
    } catch (err) {
      console.error('Error fetching post stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch post stats');
    } finally {
      setLoading(false);
    }
  };

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}

// Hook to get posts by category for the bento grid
export function usePostsByCategory() {
  const [categoryData, setCategoryData] = useState<Record<PostType, { count: number; recent: Post[] }>>({
    update: { count: 0, recent: [] },
    question: { count: 0, recent: [] },
    help: { count: 0, recent: [] },
    offer: { count: 0, recent: [] },
    event: { count: 0, recent: [] },
    alert: { count: 0, recent: [] },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategoryData();
  }, []);

  const fetchCategoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      const categories: PostType[] = ['update', 'question', 'help', 'offer', 'event', 'alert'];
      const results: Record<PostType, { count: number; recent: Post[] }> = {
        update: { count: 0, recent: [] },
        question: { count: 0, recent: [] },
        help: { count: 0, recent: [] },
        offer: { count: 0, recent: [] },
        event: { count: 0, recent: [] },
        alert: { count: 0, recent: [] },
      };

      // Fetch data for each category
      for (const category of categories) {
        // Get count
        const { count } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('post_type', category)
          .eq('is_deleted', false)
          .eq('status', 'active');

        // Get recent posts
        const { data: recentPosts } = await supabase
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
            )
          `)
          .eq('post_type', category)
          .eq('is_deleted', false)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(3);

        results[category] = {
          count: count || 0,
          recent: recentPosts || [],
        };
      }

      setCategoryData(results);
    } catch (err) {
      console.error('Error fetching category data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch category data');
    } finally {
      setLoading(false);
    }
  };

  return {
    categoryData,
    loading,
    error,
    refetch: fetchCategoryData,
  };
}
