// hooks/useHomeStats.ts
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type HomeStatsTrendingItem = {
  id: string;
  content: string;
  author: { display_name?: string | null; handle?: string | null } | null;
};

export type UseHomeStatsArgs = {
  lat: number;
  lng: number;
  radiusM: number; // not used by v6 RPC, kept for signature parity
  revalidateKey?: string | number | null;
};

export type UseHomeStatsData = {
  trendingPosts: HomeStatsTrendingItem[];
  nearbyHalfMi: number;   // 0.5 mi strict
  nearbyFiveMi: number;   // 5 mi strict (gateway)
  expiringSoon: number;
  newIn24h: number;
  topHelpers: Array<{ id: string; display_name?: string | null; handle?: string | null }>;
  lostFoundCount: number;
  recommendationsCount: number;
  urgentHelpCount: number;
};

export type UseHomeStatsResult = {
  data: UseHomeStatsData | null;
  loading: boolean;       // true only for first load
  error: string | null;
  refresh: () => Promise<void>;
};

export function useHomeStats({ lat, lng, radiusM, revalidateKey = null }: UseHomeStatsArgs): UseHomeStatsResult {
  const [data, setData] = useState<UseHomeStatsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedOnce = useRef(false);
  const params = useMemo(() => ({ lat, lng }), [lat, lng]);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      if (!hasLoadedOnce.current) setLoading(true);

      const { data: rpcData, error: rpcError } = await supabase.rpc("home_stats_v6", params);
      if (rpcError) throw rpcError;

      const normalized: UseHomeStatsData = {
        trendingPosts: (rpcData?.trending as HomeStatsTrendingItem[]) ?? [],
        nearbyHalfMi: Number(rpcData?.nearby_0_5_mi ?? 0),
        nearbyFiveMi: Number(rpcData?.nearby_5_mi ?? 0),
        expiringSoon: Number(rpcData?.expiring_soon ?? 0),
        newIn24h: Number(rpcData?.new_in_24h ?? 0),
        topHelpers: (rpcData?.top_helpers ?? []) as any[],
        lostFoundCount: Number(rpcData?.lost_found_count ?? 0),
        recommendationsCount: Number(rpcData?.recommendations_count ?? 0),
        urgentHelpCount: Number(rpcData?.urgent_help_count ?? 0),
      };

      setData(normalized);
      hasLoadedOnce.current = true;
    } catch (e: any) {
      setError(e?.message || "Failed to load home stats");
    } finally {
      setLoading(!hasLoadedOnce.current);
    }
  }, [params]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, revalidateKey]);

  const refresh = useCallback(async () => {
    await fetchStats(); // keeps content on screen while refreshing
  }, [fetchStats]);

  return { data, loading, error, refresh };
}
