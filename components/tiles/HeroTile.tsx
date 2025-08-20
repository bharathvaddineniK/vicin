import { HomeGridTile } from "@/hooks/useHomeData";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, Text, View } from "react-native";
import TileIcon from "./TileIcon";

interface HeroTileProps {
  tile: HomeGridTile;
  width: number;
  height: number;
}

export default function HeroTile({ tile, width, height }: HeroTileProps) {
  if (!tile.gradient) return null;

  return (
    <Pressable
      onPress={tile.onPress}
      accessibilityRole="button"
      accessibilityLabel={tile.accessibilityLabel}
      style={({ pressed }) => ({
        width,
        height,
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
        colors={tile.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          padding: tile.width >= 8 ? 20 : 16,
          justifyContent: "space-between",
        }}
      >
        {/* Top row: icon chip + (optional) category pill */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.20)",
              borderRadius: 10,
              padding: 6,
              marginRight: 8,
            }}
          >
            <TileIcon iconName={tile.iconName} size={20} weight="bold" color="#fff" />
          </View>

          {tile.category ? (
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
                {tile.category.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>


        {/* Body: strong title + subtle subtitle + circular chevron */}
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
                fontSize: tile.width >= 8 ? 20 : 18,
                fontWeight: "900",
                lineHeight: tile.width >= 8 ? 24 : 22,
              }}
              numberOfLines={2}
            >
              {tile.title}
            </Text>
            {tile.subtitle ? (
              <Text
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: tile.width >= 8 ? 13.5 : 13,
                  fontWeight: "600",
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {tile.subtitle}
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
