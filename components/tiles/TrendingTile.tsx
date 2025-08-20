import { HomeGridTile } from "@/hooks/useHomeData";
import React from "react";
import { Pressable, Text, View } from "react-native";
import TileIcon from "./TileIcon";

interface TrendingTileProps {
  tile: HomeGridTile;
  width: number;
  height: number;
  trendingContent?: string;
}

export default function TrendingTile({ tile, width, height, trendingContent }: TrendingTileProps) {
  const displayContent = trendingContent || tile.subtitle || "Most active posts";

  return (
    <Pressable
      onPress={tile.onPress}
      accessibilityRole="button"
      accessibilityLabel={tile.accessibilityLabel || `Trending. ${displayContent}`}
      style={({ pressed }) => ({
        width,
        height,
        backgroundColor: tile.backgroundColor,
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
      {/* Top row: icon and "Trending" label */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: 6,
          }}
        >
          <TileIcon iconName={tile.iconName} size={16} weight="regular" color={tile.textColor || "#ffffff"} />
        </View>
        <Text
          style={{ 
            color: tile.textColor, 
            fontSize: 14, 
            fontWeight: "600",
            letterSpacing: 0.3
          }}
        >
          Trending
        </Text>
      </View>

      {/* Content: 3 lines with overflow hidden */}
      <View style={{ overflow: "hidden" }}>
        <Text
          style={{ 
            color: tile.textColor, 
            fontSize: 13, 
            fontWeight: "500",
            lineHeight: 18,
            opacity: 0.9,
            height: 54, // 3 lines * 18 lineHeight = 54
          }}
          numberOfLines={3}
          ellipsizeMode="clip"
        >
          {displayContent}
        </Text>
      </View>
    </Pressable>
  );
}
