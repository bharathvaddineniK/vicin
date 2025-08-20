// screens/HomeScreen.tsx
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "@/components/Header";

import {
  Calendar,
  Clock,
  Fire,
  HandHeart,
  Info,
  MapPin,
  Question,
  Star,
  TrendUp,
  Users
} from "phosphor-react-native";

import { useCategoryCounts } from "@/hooks/useCategoryCounts";
import { useHomeStats } from "@/hooks/useHomeStats";
import { supabase } from "@/lib/supabase";

type TileType =
  | "hero"
  | "category"
  | "trending"
  | "nearby"
  | "expiring"
  | "new-today"
  | "stats"
  | "featured";

type BentoItem = {
  id: string;
  type: TileType;
  category?: "update" | "question" | "event" | "offer" | "help";
  title: string;
  subtitle?: string;
  count?: number;
  width: number;
  icon: any;
  gradient?: readonly [string, string];
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
};

/** ─────────────────────────────────────────────────────────────────────────────
 * Small helper: get viewer location (device GPS first, fallback to profile)
 * ──────────────────────────────────────────────────────────────────────────── */
function useViewerLocation() {
  const [state, setState] = useState<{
    lat: number | null;
    lng: number | null;
    radiusM: number | null;
    ready: boolean;
  }>({ lat: null, lng: null, radiusM: null, ready: false });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) Try device GPS (no prompt if already granted)
        let lat: number | null = null;
        let lng: number | null = null;

        if (Platform.OS === "ios" || Platform.OS === "android") {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              mayShowUserSettingsDialog: false,
            });
            lat = loc.coords.latitude;
            lng = loc.coords.longitude;
          }
        }

        // 2) Fallback to profile.home_location (and radius)
        let radiusM: number | null = null;
        if (
          lat == null ||
          lng == null ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user?.id) {
            const { data, error } = await supabase
              .from("profiles")
              .select("home_location, home_radius_m")
              .eq("id", user.id)
              .maybeSingle();
            if (!error && data) {
              // Supabase returns PostGIS geography as GeoJSON (lng,lat)
              const geo: any = data.home_location;
              if (geo && geo.coordinates && Array.isArray(geo.coordinates)) {
                const [lng0, lat0] = geo.coordinates as [number, number];
                lat = lat0 ?? lat;
                lng = lng0 ?? lng;
              }
              radiusM = Number.isFinite(data.home_radius_m)
                ? Number(data.home_radius_m)
                : 8047; // default 5 miles
            }
          }
        }

        // 3) Defaults if still missing
        if (radiusM == null) radiusM = 8047;

        if (!cancelled) {
          setState({
            lat: lat ?? null,
            lng: lng ?? null,
            radiusM,
            ready: lat != null && lng != null,
          });
        }
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, ready: false }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// Trim to whole words so we never show "Need jum.."
function smartTrim(s: string, max = 44) {
  if (!s) return "";
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}


export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const padding = 16;
  const gap = 12;
  const availableWidth = width - padding * 2;

  // Get viewer location (strict radius input for RPCs)
  const { lat, lng, radiusM, ready } = useViewerLocation();
  const [trendIdx, setTrendIdx] = React.useState(0);

  // If we don't have a usable location yet, show loading state
  const waitingForLocation =
    !ready || lat == null || lng == null || radiusM == null;

  // Hooks (use real lat/lng/radius) – keep your existing fallbacks
  const {
    data: counts,
    loading: countsLoading,
    error: countsError,
  } = useCategoryCounts(
    ready && lat != null && lng != null && radiusM != null
      ? { lat, lng, radiusM }
      : { lat: 0, lng: 0, radiusM: 8047 }
  );

  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
  } = useHomeStats(
    ready && lat != null && lng != null && radiusM != null
      ? { lat, lng, radiusM }
      : { lat: 0, lng: 0, radiusM: 8047 }
  );

  // We only show grid when we have location + not loading
  const loading = waitingForLocation || countsLoading || statsLoading;
  const error = !waitingForLocation && (countsError || statsError);

  // Calculate tile width based on grid units (12 column system)
  const getTileWidth = (gridWidth: number) => {
    const totalGapsInRow = 12 / gridWidth - 1;
    return (availableWidth - gap * totalGapsInRow) / (12 / gridWidth);
  };

  const tileHeight = 120; // Same height for all tiles

  // Hero content logic: Top trending post first, else most recent update
  const trendingPostsData = stats?.trendingPosts || [];
  const topTrendingPost =
    trendingPostsData.length > 0 ? trendingPostsData[0] : null;
  const heroPost = topTrendingPost || stats?.mostRecentPost || null;

  const heroTitle =
    heroPost?.content || "What's happening in your neighborhood?";
  const heroSubtitle = heroPost
    ? `${heroPost.author?.display_name || heroPost.author?.handle || "Anonymous"}`
    : "Share updates, ask questions, offer help";

  // --- Trending content rotation (NO animation, real data only) ---
  const trendingList = (stats?.trendingPosts ?? [])
    .map((p) => p?.content)
    .filter((s): s is string => !!s && s.trim().length > 0);

  const [trendIndex, setTrendIndex] = useState(0);
  useEffect(() => {
    if (trendingList.length <= 1) return;
    const id = setInterval(
      () => setTrendIndex((i) => (i + 1) % trendingList.length),
      10000
    );
    return () => clearInterval(id);
  }, [trendingList.length]);

  // Rotate trending subtitle every 10s (no animation), if we have posts
  useEffect(() => {
    const posts = stats?.trendingPosts ?? [];
    if (!posts.length) return;
    const id = setInterval(() => {
      setTrendIdx((i) => (i + 1) % posts.length);
    }, 10000);
    return () => clearInterval(id);
  }, [stats?.trendingPosts]);


  // Smart expiring/new today logic
  const expiringSoonCount = stats?.expiringSoon || 0;
  const todayCount = 0; // until your RPC adds this

  // “Near You” strict count – safe to both shapes without TS errors
  const nearbyCount = (() => {
    const s: any = stats;
    if (!s) return 0;
    if (typeof s.nearbyPosts === "number") return s.nearbyPosts;
    if (typeof s.nearby_posts === "number") return s.nearby_posts;
    return 0;
  })();

  // Build data with your existing structure
  const DEMO_DATA: BentoItem[][] = [
    // Row 1: Hero (8) + Trending (4)
    [
      {
        id: "hero-update",
        type: "hero",
        category: "update",
        title: heroTitle,
        subtitle: heroSubtitle,
        width: 8,
        icon: Info,
        gradient: ["#4A7043", "#2D572C"] as const,
      },
      {
        id: "trending-now",
        type: "trending",
        title: "Trending Now",
        subtitle:
          trendingPostsData.length > 0
            ? "Most active posts"
            : "Explore recent posts",
        width: 4,
        icon: Clock,
        backgroundColor: "#2D572C",
        textColor: "#ffffff",
      },
    ],
    // Row 2: Updates • Questions • Offers (4/4/4)
    [
      {
        id: "updates-category",
        type: "category",
        category: "update",
        title: "Updates",
        subtitle:
          (counts?.update ?? 0) > 0 ? `${counts?.update} active` : "Be first",
        width: 4,
        icon: Info,
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
      },
      {
        id: "questions-category",
        type: "category",
        category: "question",
        title: "Questions",
        subtitle:
          (counts?.question ?? 0) > 0
            ? `${counts?.question} active`
            : "Be first",
        width: 4,
        icon: Question,
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
      },
      {
        id: "offers-category",
        type: "category",
        category: "offer",
        title: "Offers",
        subtitle:
          (counts?.offer ?? 0) > 0 ? `${counts?.offer} active` : "Be first",
        width: 4,
        icon: Users,
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
      },
    ],
    // Row 3: Events • Community Help (6/6)
    [
      {
        id: "events-category",
        type: "category",
        category: "event",
        title: "Events",
        subtitle:
          (counts?.event ?? 0) > 0
            ? `${counts?.event} upcoming`
            : "Be the first to post",
        width: 6,
        icon: Calendar,
        backgroundColor: "#A9CBA4",
        textColor: "#1E3A1D",
      },
      {
        id: "help-category",
        type: "category",
        category: "help",
        title: "Community Help",
        subtitle:
          (counts?.help ?? 0) > 0
            ? `${counts?.help} active`
            : "Be the first to post",
        width: 6,
        icon: HandHeart,
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
      },
    ],
    // Row 4: This Week (8) • Top Helpers (4)
    [
      {
        id: "weekly-stats",
        type: "stats",
        title: "This Week",
        subtitle:
          (stats?.thisWeek ?? 0) > 0
            ? `${stats?.thisWeek} new posts`
            : "Getting started tips",
        width: 8,
        icon: TrendUp,
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
      },
      {
        id: "top-helpers",
        type: "featured",
        title: "Top Helpers",
        width: 4,
        icon: Star,
        backgroundColor: "#4A7043",
        textColor: "#ffffff",
      },
    ],
    // Row 5: Near You (6) • Expiring Soon/New Today (6)
    [
      {
        id: "nearby-posts",
        type: "nearby",
        title: "Near You",
        subtitle:
          nearbyCount > 0
            ? `${nearbyCount} active posts`
            : "No posts yet — start one",
        width: 6,
        icon: MapPin,
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
      },
      {
        id: expiringSoonCount > 0 ? "expiring-soon" : "new-today",
        type: expiringSoonCount > 0 ? "expiring" : "new-today",
        title: expiringSoonCount > 0 ? "Expiring Soon" : "New Today",
        subtitle:
          expiringSoonCount > 0
            ? `${expiringSoonCount} ending in 48h`
            : todayCount > 0
              ? "See what's fresh"
              : "Create an event",
        width: 6,
        icon: Clock,
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
      },
    ],
    // Row 6: Lost & Found • Recommendations • Urgent Help (4/4/4)
    [
      {
        id: "lost-found",
        type: "category",
        title: "Lost & Found",
        subtitle:
          (stats?.lostFoundCount ?? 0) > 0
            ? `${stats?.lostFoundCount} active`
            : "Be the first to post",
        width: 4,
        icon: Question,
        backgroundColor: "#A9CBA4",
        textColor: "#1E3A1D",
      },
      {
        id: "recommendations",
        type: "featured",
        title: "Recommendations",
        subtitle:
          (stats?.recommendationsCount ?? 0) > 0
            ? `${stats?.recommendationsCount} nearby`
            : "Add a trusted service",
        width: 4,
        icon: Users,
        backgroundColor: "#ffffff",
        textColor: "#1E3A1D",
        borderColor: "#6B8E66",
      },
      {
        id: "urgent-help",
        type: "category",
        title: "Urgent Help",
        subtitle:
          (stats?.urgentHelpCount ?? 0) > 0
            ? `${stats?.urgentHelpCount} need attention`
            : "Offer help",
        width: 4,
        icon: Fire,
        backgroundColor: "#2D572C",
        textColor: "#ffffff",
      },
    ],
  ];

  const BentoTile = ({
    item,
    rowIndex,
  }: {
    item: BentoItem;
    rowIndex: number;
  }) => {
    const Icon = item.icon;
    const tileWidth = getTileWidth(item.width);

    const displayTitle = item.title;
    const displaySubtitle = item.subtitle;

    // A11y helpers (unchanged)
    const getAccessibilityLabel = () => {
      const count = displaySubtitle?.match(/\d+/)?.[0];
      const hasContent = count && parseInt(count) > 0;

      if (item.type === "hero") {
        return `Featured post: ${item.title}. ${displaySubtitle}. Double tap to view updates.`;
      } else if (item.type === "trending") {
        return `Trending posts. ${trendingList[trendIndex] ?? ""}. Double tap to open trending.`;
      } else if (item.category) {
        return `${item.title} category. ${hasContent ? `${count} active posts` : "No posts yet"
          }. Double tap to ${hasContent ? "view posts" : "create first post"
          }.`;
      } else if (item.type === "stats") {
        return `${item.title} statistics. ${displaySubtitle}. Double tap to view details.`;
      } else if (item.type === "featured") {
        return `${item.title}. ${displaySubtitle}. Double tap to view more.`;
      } else {
        return `${item.title}. ${displaySubtitle}. Double tap to view.`;
      }
    };

    const getAccessibilityHint = () => {
      if (item.category) {
        const hasContent =
          displaySubtitle?.includes("active") ||
          displaySubtitle?.includes("upcoming");
        return hasContent ? `Opens ${item.category} feed` : "Opens post composer";
      }
      return "Opens related content";
    };

    // --- GRADIENT (HERO) TILE — ONLY the inner layout changed, not colors/size ---
    if (item.gradient) {
      return (
        <Pressable
          onPress={() => {
            if (item.category) {
              router.push(`/feed/${item.category}` as any);
            } else if (item.type === "hero") {
              heroPost ? router.push(`/feed/update` as any) : router.push("/(tabs)/post" as any);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={getAccessibilityLabel()}
          accessibilityHint={getAccessibilityHint()}
          style={({ pressed }) => ({
            width: tileWidth,
            height: tileHeight,
            borderRadius: 16,
            overflow: "hidden",
            transform: [{ scale: pressed ? 0.97 : 1 }],
            shadowColor: "#2D572C",
            shadowOffset: { width: 0, height: pressed ? 1 : 3 },
            shadowOpacity: pressed ? 0.15 : 0.2,
            shadowRadius: pressed ? 4 : 10,
            elevation: pressed ? 2 : 5,
          })}
        >
          <LinearGradient
            colors={item.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              padding: item.width >= 8 ? 20 : 16,
              justifyContent: "space-between",
            }}
          >
            {/* top row: icon chip + category pill */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.20)",
                  borderRadius: 10,
                  padding: 6,
                  marginRight: 8,
                }}
              >
                <Icon size={item.width >= 8 ? 20 : 18} weight="bold" color="#fff" />
              </View>
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.18)",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                }}
              >
                <Text
                  style={{
                    color: "rgba(255,255,255,0.95)",
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 0.8,
                  }}
                >
                  {item.category ? item.category.toUpperCase() : "UPDATES"}
                </Text>
              </View>
            </View>

            {/* body: strong title + subtle subtitle + circular chevron */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text
                  style={{
                    color: "#fff",
                    fontSize: item.width >= 8 ? 20 : 18,
                    fontWeight: "900",
                    lineHeight: item.width >= 8 ? 24 : 22,
                  }}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.85)",
                      fontSize: item.width >= 8 ? 13.5 : 13,
                      fontWeight: "600",
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                accessible={false}
              >
                <Text
                  style={{ color: "#fff", fontSize: 18, fontWeight: "700", opacity: 0.95 }}
                >
                  →
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      );
    }


    if (item.type === "trending") {
  const posts = stats?.trendingPosts ?? [];
  const raw = posts.length ? posts[trendIdx]?.content ?? "" : "";
  const subtitleNow = raw ? smartTrim(raw, 44) : "Most active posts";

  return (
    <Pressable
      onPress={() => router.push("/feed/trending" as any)} // correct destination
      accessibilityRole="button"
      accessibilityLabel={`Trending. ${subtitleNow}`}
      style={({ pressed }) => ({
        width: tileWidth,
        height: tileHeight,
        backgroundColor: item.backgroundColor, // #2D572C
        borderRadius: 16,
        padding: 16,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        shadowColor: "#2D572C",
        shadowOffset: { width: 0, height: pressed ? 1 : 2 },
        shadowOpacity: pressed ? 0.1 : 0.15,
        shadowRadius: pressed ? 3 : 6,
        elevation: pressed ? 1 : 3,
      })}
    >
      {/* top row: icon and "Trending" label in medium bold */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: 6,
          }}
        >
          <Clock size={16} weight="regular" color={item.textColor} />
        </View>
        <Text
          style={{ 
            color: item.textColor, 
            fontSize: 14, 
            fontWeight: "600", // medium bold
            letterSpacing: 0.3
          }}
        >
          Trending
        </Text>
      </View>

      {/* content: 3 lines of content with overflow hidden */}
      <View style={{ overflow: "hidden" }}>
        <Text
          style={{ 
            color: item.textColor, 
            fontSize: 13, 
            fontWeight: "500",
            lineHeight: 18,
            opacity: 0.9,
            height: 54, // 3 lines * 18 lineHeight = 54
          }}
          numberOfLines={3}
          ellipsizeMode="clip"
        >
          {raw || "Most active posts"}
        </Text>
      </View>
    </Pressable>
  );
}




    // --- SOLID/BORDERED TILES (unchanged) ---
    return (
      <Pressable
        onPress={() => {
          if (item.category) {
            const hasContent =
              item.subtitle?.includes("active") ||
              item.subtitle?.includes("upcoming");
            if (hasContent) {
              router.push(`/feed/${item.category}` as any);
            } else {
              router.push("/(tabs)/post" as any);
            }
          } else if (item.type === "stats") {
            if (stats?.thisWeek && stats.thisWeek > 0) {
              router.push("/feed/update" as any);
            } else {
              router.push("/(tabs)/post" as any);
            }
          } else if (item.type === "featured") {
            if (item.id === "top-helpers") {
              router.push("/feed/help" as any);
            } else if (item.id === "recommendations") {
              if (stats?.recommendationsCount && stats.recommendationsCount > 0) {
                router.push("/feed/offer" as any);
              } else {
                router.push("/(tabs)/post" as any);
              }
            }
          } else if (item.type === "nearby") {
            if (nearbyCount > 0) {
              router.push("/feed/update" as any);
            } else {
              router.push("/(tabs)/post" as any);
            }
          } else if (item.type === "expiring") {
            router.push("/feed/event" as any);
          } else if (item.type === "new-today") {
            if (todayCount > 0) {
              router.push("/feed/update" as any);
            } else {
              router.push("/(tabs)/post" as any);
            }
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={getAccessibilityLabel()}
        accessibilityHint={getAccessibilityHint()}
        style={({ pressed }) => ({
          width: tileWidth,
          height: tileHeight,
          backgroundColor: item.backgroundColor,
          borderRadius: 16,
          padding: 16,
          justifyContent: "space-between",
          transform: [{ scale: pressed ? 0.97 : 1 }],
          shadowColor:
            item.backgroundColor === "#ffffff" ? "#6B8E66" : "#2D572C",
          shadowOffset: { width: 0, height: pressed ? 1 : 2 },
          shadowOpacity: pressed ? 0.1 : 0.15,
          shadowRadius: pressed ? 3 : 6,
          elevation: pressed ? 1 : 3,
          borderWidth: item.borderColor
            ? 1
            : item.backgroundColor === "#ffffff"
              ? 1
              : 0,
          borderColor: item.borderColor || "#6B8E66",
          opacity: item.type === "featured" ? 0.95 : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              backgroundColor:
                item.backgroundColor === "#ffffff"
                  ? "#F0F4F0"
                  : item.borderColor
                    ? `${item.borderColor}20`
                    : item.textColor === "#ffffff"
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.05)",
              borderRadius: 8,
              padding: 8,
            }}
          >
            <Icon
              size={item.backgroundColor === "#ffffff" ? 24 : 20}
              weight="regular"
              color={item.borderColor || item.textColor}
            />
          </View>
          {item.count !== undefined && item.count > 0 && (
            <View
              style={{
                backgroundColor: "#D4C2A6",
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderWidth: 1,
                borderColor: "#C4B296",
              }}
            >
              <Text
                style={{ color: "#1E3A1D", fontSize: 10, fontWeight: "700" }}
              >
                {item.count}
              </Text>
            </View>
          )}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: item.textColor,
                fontSize: item.width >= 8 ? 16 : item.width >= 6 ? 15 : 14,
                fontWeight: "800",
                lineHeight: item.width >= 8 ? 20 : item.width >= 6 ? 18 : 17,
                marginBottom: 2,
              }}
              numberOfLines={rowIndex === 5 && item.width === 4 ? 1 : undefined}
              ellipsizeMode={
                rowIndex === 5 && item.width === 4 ? "tail" : undefined
              }
            >
              {displayTitle}
            </Text>
            {displaySubtitle && (
              <Text
                style={{
                  color: item.textColor,
                  fontSize: item.width >= 8 ? 13 : item.width >= 6 ? 12 : 11,
                  fontWeight: "500",
                  opacity: 0.7,
                  lineHeight: item.width >= 8 ? 16 : item.width >= 6 ? 15 : 14,
                }}
                numberOfLines={rowIndex === 5 && item.width === 4 ? 1 : undefined}
                ellipsizeMode={
                  rowIndex === 5 && item.width === 4 ? "tail" : undefined
                }
              >
                {displaySubtitle}
              </Text>
            )}
          </View>
          <Text
            style={{
              color: item.textColor,
              fontSize: 16,
              opacity: 0.6,
              marginLeft: 8,
            }}
            accessibilityLabel="Navigate to content"
            accessibilityRole="text"
          >
            →
          </Text>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#F5F7F5" }}
        edges={["top", "left", "right"]}
      >
        <Header
          title="Vicin"
          onPressSearch={() => router.push("/search" as any)}
          onPressNotifications={() => console.log("Notifications")}
          onPressProfile={() => router.push("/(tabs)/profile" as any)}
        />
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color="#4A7043" />
          <Text style={{ marginTop: 12, color: "#6B8E66", fontWeight: "600" }}>
            Loading your neighborhood…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#F5F7F5" }}
        edges={["top", "left", "right"]}
      >
        <Header
          title="Vicin"
          onPressSearch={() => router.push("/search" as any)}
          onPressNotifications={() => console.log("Notifications")}
          onPressProfile={() => router.push("/(tabs)/profile" as any)}
        />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <Text
            style={{
              color: "#DC2626",
              fontSize: 16,
              fontWeight: "700",
              marginBottom: 6,
            }}
          >
            Unable to load data
          </Text>
          <Text style={{ color: "#6B8E66", textAlign: "center" }}>
            Please check your connection and try again
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#F5F7F5" }}
      edges={["top", "left", "right"]}
    >
      <Header
        title="Vicin"
        onPressSearch={() => router.push("/search" as any)}
        onPressNotifications={() => console.log("Notifications")}
        onPressProfile={() => router.push("/(tabs)/profile" as any)}
      />

      <ScrollView
        contentContainerStyle={{
          padding,
          paddingBottom: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {DEMO_DATA.map((row, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={{
              flexDirection: "row",
              gap,
              marginBottom: gap,
              width: availableWidth,
            }}
          >
            {row.map((item) => (
              <BentoTile key={item.id} item={item} rowIndex={rowIndex} />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
