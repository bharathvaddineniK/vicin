import { HomeGridTile } from "@/hooks/useHomeData";
import React from "react";
import { Pressable, Text, View } from "react-native";
import TileIcon from "./TileIcon";

interface CategoryTileProps {
  tile: HomeGridTile;
  width: number;
  height: number;
  rowIndex?: number;
}

export default function CategoryTile({ tile, width, height, rowIndex }: CategoryTileProps) {
  const iconBg =
    tile.backgroundColor === "#ffffff"
      ? "#F0F4F0"
      : tile.borderColor
      ? `${tile.borderColor}20`
      : tile.textColor === "#ffffff"
      ? "rgba(255,255,255,0.1)"
      : "rgba(0,0,0,0.05)";

  return (
    <Pressable
      onPress={tile.onPress}
      accessibilityRole="button"
      accessibilityLabel={tile.accessibilityLabel}
      style={({ pressed }) => ({
        width,
        height,
        backgroundColor: tile.backgroundColor,
        borderRadius: 16,
        padding: 16,
        justifyContent: "space-between",
        transform: [{ scale: pressed ? 0.97 : 1 }],
        shadowColor:
          tile.backgroundColor === "#ffffff" ? "#6B8E66" : "#2D572C",
        shadowOffset: { width: 0, height: pressed ? 1 : 2 },
        shadowOpacity: pressed ? 0.1 : 0.15,
        shadowRadius: pressed ? 3 : 6,
        elevation: pressed ? 1 : 3,
        borderWidth: tile.borderColor
          ? 1
          : tile.backgroundColor === "#ffffff"
          ? 1
          : 0,
        borderColor: tile.borderColor || "#6B8E66",
        opacity: tile.variant === "featured" ? 0.95 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            backgroundColor: iconBg,
            borderRadius: 8,
            padding: 8,
          }}
        >
          <TileIcon 
            iconName={tile.iconName} 
            size={tile.backgroundColor === "#ffffff" ? 24 : 20} 
            weight="regular" 
            color={tile.borderColor || tile.textColor || "#6B8E66"} 
          />
        </View>
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
              color: tile.textColor,
              fontSize: tile.width >= 8 ? 16 : tile.width >= 6 ? 15 : 14,
              fontWeight: "800",
              lineHeight: tile.width >= 8 ? 20 : tile.width >= 6 ? 18 : 17,
              marginBottom: 2,
            }}
            numberOfLines={rowIndex === 5 && tile.width === 4 ? 1 : undefined}
            ellipsizeMode={
              rowIndex === 5 && tile.width === 4 ? "tail" : undefined
            }
          >
            {tile.title}
          </Text>
          {tile.subtitle && (
            <Text
              style={{
                color: tile.textColor,
                fontSize: tile.width >= 8 ? 13 : tile.width >= 6 ? 12 : 11,
                fontWeight: "500",
                opacity: 0.7,
                lineHeight: tile.width >= 8 ? 16 : tile.width >= 6 ? 15 : 14,
              }}
              numberOfLines={rowIndex === 5 && tile.width === 4 ? 1 : undefined}
              ellipsizeMode={
                rowIndex === 5 && tile.width === 4 ? "tail" : undefined
              }
            >
              {tile.subtitle}
            </Text>
          )}
        </View>
        <Text
          style={{
            color: tile.textColor,
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
}
