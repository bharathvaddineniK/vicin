-- Create RPC function for category counts
CREATE OR REPLACE FUNCTION public.category_counts_v1(
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
BEGIN
  -- Create point from lat/lng
  user_point := ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;
  
  -- Get counts for each category
  WITH category_counts AS (
    SELECT 
      post_type,
      COUNT(*) as count
    FROM posts p
    WHERE 
      p.status = 'active'
      AND p.is_deleted = false
      AND (p.expires_at IS NULL OR p.expires_at > NOW())
      AND ST_DWithin(p.location, user_point, radius_m)
    GROUP BY post_type
  )
  SELECT json_build_object(
    'update', COALESCE((SELECT count FROM category_counts WHERE post_type = 'update'), 0),
    'question', COALESCE((SELECT count FROM category_counts WHERE post_type = 'question'), 0),
    'help', COALESCE((SELECT count FROM category_counts WHERE post_type = 'help'), 0),
    'offer', COALESCE((SELECT count FROM category_counts WHERE post_type = 'offer'), 0),
    'event', COALESCE((SELECT count FROM category_counts WHERE post_type = 'event'), 0)
  ) INTO result;
  
  RETURN result;
END;
$$;
