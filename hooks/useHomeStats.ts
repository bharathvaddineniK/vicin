// hooks/useHomeStats.ts
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * This hook fetches all Home data in one roundtrip via RPC `home_stats_v1`.
 * Server does the heavy lifting (geo filter, RLS), keeping the client fast & secure.
 *
 * You will add the SQL for `home_stats_v1` in the next step.
 */

// ---------- Types returned by the RPC ----------
export type HomeStatsHero = {
  id: string;
  content: string;
  author: { display_name?: string | null; handle?: string | null } | null;
} | null;

export type HomeStatsTrendingItem = {
  id: string;
  content: string;
  author: { display_name?: string | null; handle?: string | null } | null;
};

export type HomeStatsResponse = {
  hero: HomeStatsHero;
  trending: HomeStatsTrendingItem[]; // 0..5 items (strict radius)
  nearby_posts: number;              // all active posts within radius
  expiring_soon: number;             // expires_at in next 48h
  this_week: number;                 // created in last 7 days
  top_helpers: Array<{ id: string; display_name?: string | null; handle?: string | null }> | null;

  // Row 6 counts
  lost_found_count: number;          // posts tagged lost/found
  recommendations_count: number;     // posts tagged recommendation
  urgent_help_count: number;         // help posts with no comments (or recent help)

  // Useful fallback for Hero if no trending
  most_recent_post: HomeStatsHero;
};

// ---------- Hook API ----------
export type UseHomeStatsArgs = {
  lat: number;
  lng: number;
  radiusM: number;
  /**
   * Optional: revalidate key to force a refresh when you know data changed
   * (e.g., after creating a post). Changing this value triggers a refetch.
   */
  revalidateKey?: string | number | null;
};

export type UseHomeStatsResult = {
  data: {
    hero: HomeStatsHero;
    trendingPosts: HomeStatsTrendingItem[];
    nearbyPosts: number;
    expiringSoon: number;
    thisWeek: number;
    topHelpers: NonNullable<HomeStatsResponse["top_helpers"]>;
    lostFoundCount: number;
    recommendationsCount: number;
    urgentHelpCount: number;
    mostRecentPost: HomeStatsHero;
  } | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useHomeStats({
  lat,
  lng,
  radiusM,
  revalidateKey = null,
}: UseHomeStatsArgs): UseHomeStatsResult {
  const [data, setData] = useState<UseHomeStatsResult["data"]>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const params = useMemo(
    () => ({
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
      radius_m: Math.max(0, Math.floor(radiusM || 0)),
    }),
    [lat, lng, radiusM]
  );

  const fetchStats = useCallback(async () => {
    if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng) || params.radius_m <= 0) {
      if (mountedRef.current) {
        setLoading(false);
        setError("Invalid location or radius");
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ Simple, supported rpc call (no abortSignal here)
      const { data: rpcData, error: rpcError } = await supabase.rpc("home_stats_v1", params);
      if (rpcError) throw rpcError;

      const normalized: UseHomeStatsResult["data"] = {
        hero: (rpcData?.hero as HomeStatsHero) ?? null,
        trendingPosts: (rpcData?.trending as HomeStatsTrendingItem[]) ?? [],
        nearbyPosts: Number(rpcData?.nearby_posts ?? 0),
        expiringSoon: Number(rpcData?.expiring_soon ?? 0),
        thisWeek: Number(rpcData?.this_week ?? 0),
        topHelpers: (rpcData?.top_helpers ?? []) as NonNullable<HomeStatsResponse["top_helpers"]>,
        lostFoundCount: Number(rpcData?.lost_found_count ?? 0),
        recommendationsCount: Number(rpcData?.recommendations_count ?? 0),
        urgentHelpCount: Number(rpcData?.urgent_help_count ?? 0),
        mostRecentPost: (rpcData?.most_recent_post as HomeStatsHero) ?? null,
      };

      if (mountedRef.current) {
        setData(normalized);
        setLoading(false);
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      console.warn("home_stats_v1 error:", e); // helpful during integration
      setError(e?.message || "Failed to load home stats");
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, revalidateKey]);

  const refresh = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  return { data, loading, error, refresh };
}
