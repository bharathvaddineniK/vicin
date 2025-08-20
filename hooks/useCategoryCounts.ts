// hooks/useCategoryCounts.ts
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * useCategoryCounts
 * Returns strict‑radius counts for the five categories:
 *  - update, question, help, offer, event
 *
 * Expects a Postgres RPC:
 *   public.category_counts_v1(lat double precision, lng double precision, radius_m integer)
 * that enforces:
 *   status='active', is_deleted=false, (expires_at is null or > now),
 *   ST_DWithin(post.location, user_point, radius_m) AND ST_DWithin(post.location, user_point, post.visibility_radius_m)
 *
 * This hook does a single roundtrip and normalizes the result.
 */

export type CategoryCounts = {
  update: number;
  question: number;
  help: number;
  offer: number;
  event: number;
};

export type UseCategoryCountsArgs = {
  lat: number;
  lng: number;
  radiusM: number;
  /** Optional external key that forces a refresh when changed */
  revalidateKey?: string | number | null;
};

export type UseCategoryCountsResult = {
  data: CategoryCounts | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useCategoryCounts({
  lat,
  lng,
  radiusM,
  revalidateKey = null,
}: UseCategoryCountsArgs = {} as UseCategoryCountsArgs): UseCategoryCountsResult {
  const [data, setData] = useState<CategoryCounts | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Prevent state updates after unmount
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

  const fetchCounts = useCallback(async () => {
    if (
      !Number.isFinite(params.lat) ||
      !Number.isFinite(params.lng) ||
      params.radius_m <= 0
    ) {
      if (mountedRef.current) {
        setLoading(false);
        setError("Invalid location or radius");
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "category_counts_v1",
        params
      );

      if (rpcError) throw rpcError;

      const normalized: CategoryCounts = {
        update: Number(rpcData?.update ?? 0),
        question: Number(rpcData?.question ?? 0),
        help: Number(rpcData?.help ?? 0),
        offer: Number(rpcData?.offer ?? 0),
        event: Number(rpcData?.event ?? 0),
      };

      if (mountedRef.current) {
        setData(normalized);
        setLoading(false);
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e?.message || "Failed to load category counts");
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCounts, revalidateKey]);

  const refresh = useCallback(() => {
    fetchCounts();
  }, [fetchCounts]);

  return { data, loading, error, refresh };
}
