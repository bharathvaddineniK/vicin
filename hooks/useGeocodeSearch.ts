// hooks/useGeocodeSearch.ts
// Production-grade forward geocode hook with debounce, cancellation and guards.
// Calls your deployed Edge Function: /functions/v1/geocode?q=...&lat=...&lng=...&limit=...
// Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your env.

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

// Minimal result shape mirrored from the Edge Function
export type GeocodeResult = {
  id: string | null;
  label: string;
  subtitle: string;
  coords: { lat: number; lng: number } | null;
  source: "geoapify";
};

type UseGeocodeOpts = {
  debounceMs?: number;    // default 300
  limit?: number;         // default 5
  // Optional bias near viewer
  bias?: { lat: number; lng: number } | null;
};

type State = {
  results: GeocodeResult[];
  loading: boolean;
  error: string | null;
  query: string;
};

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") || "";
const SUPABASE_ANON =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * useGeocodeSearch
 * Debounced, cancelable geocode search against Supabase Edge Function.
 *
 * NOTE: The anon key is public; we only hit our own function domain.
 * Guards:
 *  - no request if query < 3 chars
 *  - clamps limit to [1..10]
 *  - aborts in-flight request on new keystroke/unmount
 */
export function useGeocodeSearch(opts: UseGeocodeOpts = {}) {
  const { debounceMs = 300, limit = 5, bias = null } = opts;

  const [state, setState] = useState<State>({
    results: [],
    loading: false,
    error: null,
    query: "",
  });

  // keep refs for debounce/abort
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const setQuery = useCallback((q: string) => {
    setState((s) => ({ ...s, query: q }));
  }, []);

  const searchNow = useCallback(async (q: string) => {
    if (!SUPABASE_URL || !SUPABASE_ANON) {
      setState((s) => ({
        ...s,
        loading: false,
        error: "Missing Supabase env (URL or anon key).",
      }));
      return;
    }

    // guard: require min 3 chars
    if (!q || q.trim().length < 3) {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, results: [], loading: false, error: null }));
      return;
    }

    // clamp limit
    const lim = Math.min(10, Math.max(1, Math.floor(limit)));

    // abort previous
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    params.set("q", q.trim());
    params.set("limit", String(lim));
    if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
      // Edge Function already accepts lat/lng to bias results
      params.set("lat", String(bias.lat));
      params.set("lng", String(bias.lng));
    }

    const url = `${SUPABASE_URL}/functions/v1/geocode?${params.toString()}`;

    try {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, loading: true, error: null }));

      const res = await fetch(url, {
        method: "GET",
        headers: {
          // anon key is required by Edge Functions
          Authorization: `Bearer ${SUPABASE_ANON}`,
          "X-Client-Platform": Platform.OS,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Geocode failed (${res.status})${text ? `: ${text}` : ""}`,
        );
      }

      const json = await res.json();
      const results: GeocodeResult[] = Array.isArray(json?.results)
        ? json.results
        : [];

      if (!mountedRef.current) return;
      setState((s) => ({ ...s, results, loading: false, error: null }));
    } catch (e: any) {
      if (e?.name === "AbortError") return; // request was cancelled; no state change
      if (!mountedRef.current) return;
      setState((s) => ({
        ...s,
        loading: false,
        error: e?.message || "Unknown geocode error",
      }));
    }
  }, [limit]);

  // debounced search when query changes
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = state.query;

    timerRef.current = setTimeout(() => {
      searchNow(q);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.query, debounceMs, searchNow]);

  // manual imperative trigger (e.g., on submit)
  const search = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    return searchNow(state.query);
  }, [searchNow, state.query]);

  return {
    results: state.results,
    loading: state.loading,
    error: state.error,
    query: state.query,
    setQuery,
    search,       // optional manual trigger
  };
}

export default useGeocodeSearch;
