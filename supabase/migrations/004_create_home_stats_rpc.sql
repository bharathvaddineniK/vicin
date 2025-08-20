-- Create RPC function for home stats
CREATE OR REPLACE FUNCTION public.home_stats_v1(
  lat double precision,
  lng double precision,
  radius_m integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_point geography;
  result json;
  hero_post json;
  trending_posts json;
  most_recent_post json;
  top_helpers_data json;
BEGIN
  -- Create point from lat/lng
  user_point := ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;
  
  -- Get hero post (most liked post in last 24h)
  SELECT json_build_object(
    'id', p.id,
    'content', p.content,
    'author', json_build_object(
      'display_name', pr.display_name,
      'handle', pr.handle
    )
  ) INTO hero_post
  FROM posts p
  LEFT JOIN profiles pr ON p.author_id = pr.id
  LEFT JOIN (
    SELECT post_id, COUNT(*) as like_count
    FROM post_likes
    GROUP BY post_id
  ) likes ON p.id = likes.post_id
  WHERE 
    p.status = 'active'
    AND p.is_deleted = false
    AND (p.expires_at IS NULL OR p.expires_at > NOW())
    AND p.created_at > NOW() - INTERVAL '24 hours'
    AND ST_DWithin(p.location, user_point, radius_m)
  ORDER BY COALESCE(likes.like_count, 0) DESC, p.created_at DESC
  LIMIT 1;

  -- Get trending posts (top 5 by likes in last 7 days)
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'content', p.content,
      'author', json_build_object(
        'display_name', pr.display_name,
        'handle', pr.handle
      )
    )
  ) INTO trending_posts
  FROM (
    SELECT p.*, COALESCE(likes.like_count, 0) as like_count
    FROM posts p
    LEFT JOIN profiles pr ON p.author_id = pr.id
    LEFT JOIN (
      SELECT post_id, COUNT(*) as like_count
      FROM post_likes
      GROUP BY post_id
    ) likes ON p.id = likes.post_id
    WHERE 
      p.status = 'active'
      AND p.is_deleted = false
      AND (p.expires_at IS NULL OR p.expires_at > NOW())
      AND p.created_at > NOW() - INTERVAL '7 days'
      AND ST_DWithin(p.location, user_point, radius_m)
    ORDER BY like_count DESC, p.created_at DESC
    LIMIT 5
  ) p
  LEFT JOIN profiles pr ON p.author_id = pr.id;

  -- Get most recent post (fallback for hero)
  SELECT json_build_object(
    'id', p.id,
    'content', p.content,
    'author', json_build_object(
      'display_name', pr.display_name,
      'handle', pr.handle
    )
  ) INTO most_recent_post
  FROM posts p
  LEFT JOIN profiles pr ON p.author_id = pr.id
  WHERE 
    p.status = 'active'
    AND p.is_deleted = false
    AND (p.expires_at IS NULL OR p.expires_at > NOW())
    AND ST_DWithin(p.location, user_point, radius_m)
  ORDER BY p.created_at DESC
  LIMIT 1;

  -- Get top helpers (users with most helpful posts)
  SELECT json_agg(
    json_build_object(
      'id', pr.id,
      'display_name', pr.display_name,
      'handle', pr.handle
    )
  ) INTO top_helpers_data
  FROM (
    SELECT p.author_id, COUNT(*) as help_count
    FROM posts p
    WHERE 
      p.status = 'active'
      AND p.is_deleted = false
      AND p.post_type = 'help'
      AND p.created_at > NOW() - INTERVAL '30 days'
      AND ST_DWithin(p.location, user_point, radius_m)
    GROUP BY p.author_id
    ORDER BY help_count DESC
    LIMIT 3
  ) helpers
  LEFT JOIN profiles pr ON helpers.author_id = pr.id;

  -- Build final result
  SELECT json_build_object(
    'hero', hero_post,
    'trending', COALESCE(trending_posts, '[]'::json),
    'nearby_posts', (
      SELECT COUNT(*)
      FROM posts p
      WHERE 
        p.status = 'active'
        AND p.is_deleted = false
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND ST_DWithin(p.location, user_point, radius_m)
    ),
    'expiring_soon', (
      SELECT COUNT(*)
      FROM posts p
      WHERE 
        p.status = 'active'
        AND p.is_deleted = false
        AND p.expires_at IS NOT NULL
        AND p.expires_at > NOW()
        AND p.expires_at < NOW() + INTERVAL '48 hours'
        AND ST_DWithin(p.location, user_point, radius_m)
    ),
    'this_week', (
      SELECT COUNT(*)
      FROM posts p
      WHERE 
        p.status = 'active'
        AND p.is_deleted = false
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND p.created_at > NOW() - INTERVAL '7 days'
        AND ST_DWithin(p.location, user_point, radius_m)
    ),
    'top_helpers', COALESCE(top_helpers_data, '[]'::json),
    'lost_found_count', (
      SELECT COUNT(*)
      FROM posts p
      WHERE 
        p.status = 'active'
        AND p.is_deleted = false
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND ('lost' = ANY(p.tags) OR 'found' = ANY(p.tags))
        AND ST_DWithin(p.location, user_point, radius_m)
    ),
    'recommendations_count', (
      SELECT COUNT(*)
      FROM posts p
      WHERE 
        p.status = 'active'
        AND p.is_deleted = false
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND 'recommendation' = ANY(p.tags)
        AND ST_DWithin(p.location, user_point, radius_m)
    ),
    'urgent_help_count', (
      SELECT COUNT(*)
      FROM posts p
      LEFT JOIN post_comments pc ON p.id = pc.post_id
      WHERE 
        p.status = 'active'
        AND p.is_deleted = false
        AND p.post_type = 'help'
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND pc.id IS NULL -- No comments yet
        AND ST_DWithin(p.location, user_point, radius_m)
    ),
    'most_recent_post', most_recent_post
  ) INTO result;
  
  RETURN result;
END;
$$;
