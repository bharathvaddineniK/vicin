// screens/HomeScreen.tsx
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "@/components/Header";
import CategoryTile from "@/components/tiles/CategoryTile";
import HeroTile from "@/components/tiles/HeroTile";
import TrendingTile from "@/components/tiles/TrendingTile";
import { HomeGridTile, useHomeData } from "@/hooks/useHomeData";
import { useViewerLocation } from "@/hooks/useViewerLocation";

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const padding = 16;
  const gap = 12;
  const availableWidth = width - padding * 2;
  const tileHeight = 120;

  // Viewer location
  const { lat, lng, radiusM, ready } = useViewerLocation();

  // Home data (no focus refresh — only pull refresh via `refresh`)
  const { loading, error, gridRows, trendingContent, refresh } = useHomeData({
    lat,
    lng,
    radiusM,
    ready,
  });

  // Pull-to-refresh (content stays visible)
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  // 12‑column width helper
  const getTileWidth = (gridWidth: number) => {
    const totalGapsInRow = 12 / gridWidth - 1;
    return (availableWidth - gap * totalGapsInRow) / (12 / gridWidth);
  };

  // Tile renderer
  const renderTile = (tile: HomeGridTile, rowIndex: number) => {
    const tileWidth = getTileWidth(tile.width);

    if (tile.variant === "hero") {
      return <HeroTile key={tile.id} tile={tile} width={tileWidth} height={tileHeight} />;
    }

    if (tile.variant === "trending") {
      return (
        <TrendingTile
          key={tile.id}
          tile={tile}
          width={tileWidth}
          height={tileHeight}
          trendingContent={trendingContent}
        />
      );
    }

    return (
      <CategoryTile
        key={tile.id}
        tile={tile}
        width={tileWidth}
        height={tileHeight}
        rowIndex={rowIndex}
      />
    );
  };

  // Show loader only on first ever load
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F7F5" }} edges={["top", "left", "right"]}>
        <Header
          title="Vicin"
          onPressNotifications={() => console.log("Notifications")}
          onPressProfile={() => router.push("/(tabs)/profile" as any)}
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#4A7043" />
          <Text style={{ marginTop: 12, color: "#6B8E66", fontWeight: "600" }}>
            Loading your neighborhood…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // If error after first load, keep the page and allow pull-to-refresh
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F7F5" }} edges={["top", "left", "right"]}>
      <Header
        title="Vicin"
        onPressNotifications={() => console.log("Notifications")}
        onPressProfile={() => router.push("/(tabs)/profile" as any)}
      />
      <ScrollView
        contentContainerStyle={{ padding, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A7043" />
        }
      >
        {!!error && (
          <View style={{ paddingBottom: 8 }}>
            <Text
              style={{
                color: "#DC2626",
                fontSize: 14,
                fontWeight: "700",
                marginBottom: 4,
                textAlign: "center",
              }}
            >
              Couldn’t refresh. Pull to retry.
            </Text>
          </View>
        )}

        {gridRows.map((row, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={{
              flexDirection: "row",
              gap,
              marginBottom: gap,
              width: availableWidth,
            }}
          >
            {row.map((tile) => renderTile(tile, rowIndex))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
