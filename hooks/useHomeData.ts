// hooks/useHomeData.ts
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCategoryCounts } from "./useCategoryCounts";
import { useHomeStats } from "./useHomeStats";

interface UseHomeDataProps {
  lat: number | null;
  lng: number | null;
  radiusM: number | null;
  ready: boolean;
}

export interface HomeGridTile {
  id: string;
  variant: "hero" | "trending" | "category" | "stats" | "featured" | "nearby" | "expiring";
  category?: "update" | "question" | "event" | "offer" | "help";
  title: string;
  subtitle?: string;
  width: 4 | 6 | 8;
  iconName: string;
  gradient?: readonly [string, string];
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

export function useHomeData({ lat, lng, radiusM, ready }: UseHomeDataProps) {
  // Force refetch key (used only by manual pull-to-refresh or realtime if you wire it elsewhere)
  const [revalidateKey, setRevalidateKey] = useState<number>(0);

  // Use real location or harmless fallback until ready
  const loc = useMemo(
    () =>
      ready && lat != null && lng != null && radiusM != null
        ? { lat, lng, radiusM }
        : { lat: 37.7749, lng: -122.4194, radiusM: 8047 },
    [ready, lat, lng, radiusM]
  );

  const {
    data: counts,
    loading: countsLoading,
    error: countsError,
    refresh: refreshCounts,
  } = useCategoryCounts({ ...loc, revalidateKey });

  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
    refresh: refreshStats,
  } = useHomeStats({ ...loc, revalidateKey });

  // Track if we’ve shown at least one successful payload; prevents full-screen loader later
  const hasShownDataRef = useRef(false);
  useEffect(() => {
    if (counts && stats) {
      hasShownDataRef.current = true;
    }
  }, [counts, stats]);

  // Public refresh for pull-to-refresh (keeps content on screen)
  const refresh = useCallback(async () => {
    setRevalidateKey(Date.now());
    await Promise.allSettled([refreshCounts(), refreshStats()]);
  }, [refreshCounts, refreshStats]);

  // NO refresh on focus anymore — removed useFocusEffect

  // Rotate trending text every 10s (no animation)
  const trendingList = useMemo(
    () => (stats?.trendingPosts ?? []).map((p) => p?.content).filter((s): s is string => !!s?.trim()),
    [stats?.trendingPosts]
  );
  const [trendIndex, setTrendIndex] = useState(0);
  useEffect(() => {
    setTrendIndex(0);
  }, [trendingList.length]);
  useEffect(() => {
    if (trendingList.length <= 1) return;
    const id = setInterval(() => setTrendIndex((i) => (i + 1) % trendingList.length), 10000);
    return () => clearInterval(id);
  }, [trendingList.length]);

  // Loading/error: only show full-screen loader before we’ve ever shown data
  const waitingForLocation = !ready || lat == null || lng == null || radiusM == null;
  const loadingInitial =
    !hasShownDataRef.current && (waitingForLocation || countsLoading || statsLoading);
  const error = !waitingForLocation && !hasShownDataRef.current && (countsError || statsError);

  // Hero (gateway to all posts in 5 mi)
  const heroTitle = "Everything Nearby";
  const heroSubtitle =
    (stats?.nearbyFiveMi ?? 0) > 0
      ? `${stats?.nearbyFiveMi} posts within 5 mi`
      : "Browse all posts within 5 mi";

  // Nearby = 0.5 mi strict
  const nearbyHalfMi = stats?.nearbyHalfMi ?? 0;

  // Category counts
  const cUpdate = counts?.update ?? 0;
  const cQuestion = counts?.question ?? 0;
  const cHelp = counts?.help ?? 0;
  const cOffer = counts?.offer ?? 0;
  const cEvent = counts?.event ?? 0;

  const expiringSoon = stats?.expiringSoon ?? 0;

  // Navigation
  const handleHeroPress = () => router.push("/feed/all" as any);
  const handleTrendingPress = () => router.push("/feed/trending" as any);
  const handleCategoryPress = (category: string) => router.push(`/feed/${category}` as any);
  const handleNearbyPress = () =>
    nearbyHalfMi > 0 ? router.push("/feed/all" as any) : router.push("/(tabs)/post" as any);
  const handleExpiringPress = () => router.push("/feed/expiring" as any);
  const handleNewTodayPress = () => router.push("/feed/recent" as any);

  const gridRows: HomeGridTile[][] = [
    [
      {
        id: "hero-gateway",
        variant: "hero",
        title: heroTitle,
        subtitle: heroSubtitle,
        width: 8,
        iconName: "Info",
        gradient: ["#4A7043", "#2D572C"] as const,
        onPress: handleHeroPress,
        accessibilityLabel: `${heroTitle}. ${heroSubtitle}.`,
      },
      {
        id: "trending-now",
        variant: "trending",
        title: "Trending",
        subtitle: "Most active posts",
        width: 4,
        iconName: "Fire",
        backgroundColor: "#2D572C",
        textColor: "#ffffff",
        onPress: handleTrendingPress,
        accessibilityLabel: `Trending. ${(trendingList[trendIndex] ?? "").slice(0, 140)}`,
      },
    ],
    [
      {
        id: "updates-category",
        variant: "category",
        category: "update",
        title: "Updates",
        subtitle: cUpdate > 0 ? `${cUpdate} active` : "Be first",
        width: 4,
        iconName: "Info",
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
        onPress: () => handleCategoryPress("update"),
      },
      {
        id: "questions-category",
        variant: "category",
        category: "question",
        title: "Questions",
        subtitle: cQuestion > 0 ? `${cQuestion} active` : "Be first",
        width: 4,
        iconName: "Question",
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
        onPress: () => handleCategoryPress("question"),
      },
      {
        id: "offers-category",
        variant: "category",
        category: "offer",
        title: "Offers",
        subtitle: cOffer > 0 ? `${cOffer} active` : "Be first",
        width: 4,
        iconName: "Users",
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
        onPress: () => handleCategoryPress("offer"),
      },
    ],
    [
      {
        id: "events-category",
        variant: "category",
        category: "event",
        title: "Events",
        subtitle: cEvent > 0 ? `${cEvent} upcoming` : "Be the first to post",
        width: 6,
        iconName: "Calendar",
        backgroundColor: "#A9CBA4",
        textColor: "#1E3A1D",
        onPress: () => handleCategoryPress("event"),
      },
      {
        id: "help-category",
        variant: "category",
        category: "help",
        title: "Community Help",
        subtitle: cHelp > 0 ? `${cHelp} active` : "Be the first to post",
        width: 6,
        iconName: "HandHeart",
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
        onPress: () => handleCategoryPress("help"),
      },
    ],
    [
      {
        id: "new-in-24h",
        variant: "stats",
        title: "New in 24h",
        subtitle:
          (stats?.newIn24h ?? 0) > 0 ? `${stats?.newIn24h} new posts` : "Be the first to share",
        width: 8,
        iconName: "TrendUp",
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
        onPress: handleNewTodayPress,
      },
      {
        id: "top-helpers",
        variant: "featured",
        title: "Top Helpers",
        subtitle:
          (stats?.topHelpers?.length ?? 0) > 0
            ? "Most helpful neighbors"
            : "Offer help to get featured",
        width: 4,
        iconName: "Star",
        backgroundColor: "#4A7043",
        textColor: "#ffffff",
        onPress: () => router.push("/feed/help" as any),
      },
    ],
    [
      {
        id: "nearby-posts",
        variant: "nearby",
        title: "Near You",
        subtitle: nearbyHalfMi > 0 ? `${nearbyHalfMi} active posts` : "No posts yet — start one",
        width: 6,
        iconName: "MapPin",
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
        onPress: handleNearbyPress,
      },
      {
        id: (expiringSoon ?? 0) > 0 ? "expiring-soon" : "new-today",
        variant: (expiringSoon ?? 0) > 0 ? "expiring" : "stats",
        title: (expiringSoon ?? 0) > 0 ? "Expiring Soon" : "New Today",
        subtitle:
          (expiringSoon ?? 0) > 0 ? `${expiringSoon} ending in 48h` : "See what's fresh",
        width: 6,
        iconName: "Clock",
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
        onPress: (expiringSoon ?? 0) > 0 ? handleExpiringPress : handleNewTodayPress,
      },
    ],
    [
      {
        id: "lost-found",
        variant: "category",
        title: "Lost & Found",
        subtitle:
          (stats?.lostFoundCount ?? 0) > 0
            ? `${stats?.lostFoundCount} active`
            : "Be the first to post",
        width: 4,
        iconName: "Question",
        backgroundColor: "#A9CBA4",
        textColor: "#1E3A1D",
        onPress: () => router.push("/feed/lost-found" as any),
      },
      {
        id: "recommendations",
        variant: "featured",
        title: "Recommendations",
        subtitle:
          (stats?.recommendationsCount ?? 0) > 0
            ? `${stats?.recommendationsCount} nearby`
            : "Add a trusted service",
        width: 4,
        iconName: "Users",
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
        onPress: () => router.push("/feed/recommendations" as any),
      },
      {
        id: "urgent-help",
        variant: "category",
        title: "Urgent Help",
        subtitle:
          (stats?.urgentHelpCount ?? 0) > 0
            ? `${stats?.urgentHelpCount} need attention`
            : "Offer help",
        width: 4,
        iconName: "Fire",
        backgroundColor: "#2D572C",
        textColor: "#ffffff",
        onPress: () => router.push("/feed/help?filter=unanswered" as any),
      },
    ],
  ];

  return {
    loading: loadingInitial,
    error,
    gridRows,
    trendingContent: trendingList[trendIndex],
    refresh,
  };
}
