// hooks/useGeocodeSearch.ts
import { supabase } from "@/lib/supabase";
import { useCallback, useMemo, useRef, useState } from "react";

export type GeocodeResult = {
  id?: string | null;
  label: string;
  subtitle?: string;
  coords?: { lat: number; lng: number } | null;
  source?: string;
};

type State = "idle" | "loading" | "success" | "error";

export default function useGeocodeSearch(opts?: {
  minChars?: number;
  limit?: number;
  bias?: { lat: number; lng: number } | null;
  debounceMs?: number;
}) {
  const minChars = opts?.minChars ?? 3;
  const limit = opts?.limit ?? 6;
  const bias = opts?.bias ?? null;
  const debounceMs = opts?.debounceMs ?? 250;

  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<State>("idle");
  const [sessionToken, setSessionToken] = useState<string | null>(null); // Google session

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIssuedRef = useRef<string>("");

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const clear = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setResults([]);
    setError(null);
    setLoading(false);
    setStatus("idle");
  }, []);

  const buildBaseUrl = useCallback(() => {
    if (!supabaseUrl) throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
    return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/geocode`;
  }, [supabaseUrl]);

  const getAuthHeader = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    const jwt = data?.session?.access_token;
    if (jwt) return `Bearer ${jwt}`;
    if (anonKey) return `Bearer ${anonKey}`;
    throw new Error("Missing auth: no session and EXPO_PUBLIC_SUPABASE_ANON_KEY not set");
  }, [anonKey]);

  const doFetch = useCallback(
    async (q: string) => {
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      setStatus("loading");
      setError(null);

      try {
        const base = buildBaseUrl();
        const url = new URL(base);
        url.searchParams.set("q", q);
        url.searchParams.set("limit", String(limit));
        if (bias?.lat != null && bias?.lng != null) {
          url.searchParams.set("lat", String(bias.lat));
          url.searchParams.set("lng", String(bias.lng));
        }
        if (sessionToken) url.searchParams.set("session", sessionToken);

        const auth = await getAuthHeader();
        lastIssuedRef.current = q;

        const res = await fetch(url.toString(), {
          method: "GET",
          headers: { Authorization: auth, Accept: "application/json" },
          signal: ac.signal,
        });
        if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);

        const json = (await res.json()) as {
          query: string;
          results: GeocodeResult[];
          count?: number;
          session?: string;
        };

        // server can echo back a session id; keep first generated if we don't have one yet
        if (!sessionToken && json.session) setSessionToken(json.session);

        if (lastIssuedRef.current !== q) return; // stale
        setResults(Array.isArray(json.results) ? json.results : []);
        setStatus("success");
        setLoading(false);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message ?? "Search failed");
        setResults([]);
        setStatus("error");
        setLoading(false);
      }
    },
    [bias?.lat, bias?.lng, buildBaseUrl, getAuthHeader, limit, sessionToken]
  );

  const search = useCallback(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < minChars) {
      if (abortRef.current) abortRef.current.abort();
      setResults([]);
      setStatus("idle");
      setLoading(false);
      setError(null);
      return;
    }
    debounceRef.current = setTimeout(() => doFetch(q), debounceMs);
  }, [debounceMs, doFetch, minChars, query]);

  // Fetch details for a selected Google prediction (coords)
  const resolvePlace = useCallback(
    async (id: string) => {
      const base = buildBaseUrl();
      const url = new URL(base);
      url.searchParams.set("id", id);
      if (sessionToken) url.searchParams.set("session", sessionToken);

      const auth = await getAuthHeader();
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: auth, Accept: "application/json" },
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);

      const json = (await res.json()) as { results: GeocodeResult[] };
      return (json.results?.[0] ?? null) as GeocodeResult | null;
    },
    [buildBaseUrl, getAuthHeader, sessionToken]
  );

  return useMemo(
    () => ({
      // state
      query,
      setQuery,
      results,
      loading,
      error,
      status,

      // actions
      search,         // debounce-driven autocomplete
      clear,          // reset internal state
      resolvePlace,   // fetch coords for a selected prediction
      sessionToken,
      setSessionToken,
    }),
    [clear, error, loading, query, resolvePlace, results, search, sessionToken, setSessionToken, status, setQuery]
  );
}
