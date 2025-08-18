// components/bento/BentoGrid.tsx
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import {
  Animated,
  ColorValue,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type PostType = "update" | "question" | "help" | "offer" | "event";
type TileKind = "hero" | "medium" | "small" | "banner";

export type BentoTile = {
  id: string;
  kind: TileKind;
  type: PostType;
  title?: string;
  subtitle?: string;
};

type Props = {
  items?: BentoTile[]; // optional data; demo fills if empty
  onPressTile?: (t: BentoTile) => void;
  gap?: number; // gutter between tiles (default 12)
  padding?: number; // outer padding (default 12)
};

// ---- Theme ----
const RAD = 16;
const GAP = 12;
const PAD = 12;

const TYPE_GRADIENTS: Record<
  PostType,
  readonly [ColorValue, ColorValue, ...ColorValue[]]
> = {
  update: ["#D8B4FE", "#818CF8"] as const,
  question: ["#6EE7B7", "#3B82F6"] as const,
  help: ["#FCA5A5", "#FB7185"] as const,
  offer: ["#FDE68A", "#F59E0B"] as const,
  event: ["#93C5FD", "#6366F1"] as const,
};

const TEXT_ON_GRADIENT = "#0B1220";
const GLASS = "rgba(255,255,255,0.45)";

// ---- Demo items (placeholder to showcase pattern) ----
const DEMO: BentoTile[] = Array.from({ length: 40 }).map((_, i) => {
  const types: PostType[] = ["update", "question", "help", "offer", "event"];
  const cycle: TileKind[] = [
    "hero",
    "medium",
    "small",
    "medium",
    "small",
    "medium",
    "banner",
  ];
  return {
    id: `demo-${i}`,
    type: types[i % types.length],
    kind: cycle[i % cycle.length] as TileKind,
    title:
      cycle[i % cycle.length] === "hero"
        ? "Neighborhood Meetup"
        : cycle[i % cycle.length] === "banner"
          ? "Trending around you"
          : "Tap to open",
    subtitle:
      cycle[i % cycle.length] === "hero"
        ? "Bring friends. Share updates."
        : "Explore",
  };
});

// ---- Base Gradient Tile with subtle press animation ----
const Tile = React.memo(function Tile({
  cols,
  height,
  tile,
  onPress,
}: {
  cols: number; // 1..12
  height: number;
  tile: BentoTile;
  onPress?: () => void;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();

  const gradient = TYPE_GRADIENTS[tile.type];

  return (
    <View style={{ flex: cols }}>
      <Animated.View
        style={{
          height,
          transform: [{ scale }],
          borderRadius: RAD,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}
      >
        <Pressable
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          android_ripple={{ color: "rgba(0,0,0,0.06)" }}
          style={{ flex: 1 }}
          accessibilityRole="button"
          accessibilityLabel={
            tile.title ? `${tile.type}: ${tile.title}` : tile.type
          }
        >
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          >
            <View style={styles.glass} />
            <View style={styles.tileInner}>
              <View style={styles.typeBadge}>
                <Text numberOfLines={1} style={styles.typeBadgeText}>
                  {tile.type.toUpperCase()}
                </Text>
              </View>
              {!!tile.title && (
                <Text numberOfLines={2} style={styles.title}>
                  {tile.title}
                </Text>
              )}
              {!!tile.subtitle && (
                <Text numberOfLines={1} style={styles.subtitle}>
                  {tile.subtitle}
                </Text>
              )}
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
});

// ---- Grid ----
export default function BentoGrid({
  items,
  onPressTile,
  gap = GAP,
  padding = PAD,
}: Props) {
  // fixed heights (polished but lightweight)
  const H_SMALL = 118;
  const H_MED = 160;
  const H_BANNER = 152;
  const H_LARGE = H_MED + gap + H_SMALL; // equals stacked right column height

  const data = useMemo(() => (items && items.length ? items : DEMO), [items]);

  // cursor helper to consume items in order (placeholder behavior)
  let i = 0;
  const pick = () => data[i++ % data.length];

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: padding,
        paddingTop: padding,
        paddingBottom: padding,
      }}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews
    >
      {/* render a few repeating 4-row blocks */}
      {Array.from({ length: 6 }).map((_, block) => {
        const r1_large = pick();
        const r1_med = pick();
        const r1_small = pick();

        const r2_m1 = pick();
        const r2_m2 = pick();
        const r2_m3 = pick();

        const r3_s1 = pick();
        const r3_large = pick();
        const r3_s2 = pick();

        const r4_banner = pick();

        return (
          <View key={`blk-${block}`} style={{ marginBottom: gap }}>
            {/* Row 1: [Large(8)] + [Medium(4) stacked over Small(4)] */}
            <View style={[styles.row, { gap, marginBottom: gap }]}>
              <Tile
                cols={8}
                height={H_LARGE}
                tile={r1_large}
                onPress={() => onPressTile?.(r1_large)}
              />
              <View style={{ flex: 4, gap }}>
                <Tile
                  cols={4}
                  height={H_MED}
                  tile={r1_med}
                  onPress={() => onPressTile?.(r1_med)}
                />
                <Tile
                  cols={4}
                  height={H_SMALL}
                  tile={r1_small}
                  onPress={() => onPressTile?.(r1_small)}
                />
              </View>
            </View>

            {/* Row 2: [Medium(4)] x 3 */}
            <View style={[styles.row, { gap, marginBottom: gap }]}>
              <Tile
                cols={4}
                height={H_MED}
                tile={r2_m1}
                onPress={() => onPressTile?.(r2_m1)}
              />
              <Tile
                cols={4}
                height={H_MED}
                tile={r2_m2}
                onPress={() => onPressTile?.(r2_m2)}
              />
              <Tile
                cols={4}
                height={H_MED}
                tile={r2_m3}
                onPress={() => onPressTile?.(r2_m3)}
              />
            </View>

            {/* Row 3: [Small(3)] + [Large(6)] + [Small(3)] */}
            <View style={[styles.row, { gap, marginBottom: gap }]}>
              <Tile
                cols={3}
                height={H_SMALL}
                tile={r3_s1}
                onPress={() => onPressTile?.(r3_s1)}
              />
              <Tile
                cols={6}
                height={H_SMALL}
                tile={r3_large}
                onPress={() => onPressTile?.(r3_large)}
              />
              <Tile
                cols={3}
                height={H_SMALL}
                tile={r3_s2}
                onPress={() => onPressTile?.(r3_s2)}
              />
            </View>

            {/* Row 4: [Banner(12)] */}
            <View style={{ marginBottom: gap }}>
              <View style={[styles.row, { gap }]}>
                <Tile
                  cols={12}
                  height={H_BANNER}
                  tile={r4_banner}
                  onPress={() => onPressTile?.(r4_banner)}
                />
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
  },
  glass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GLASS,
  },
  tileInner: {
    flex: 1,
    padding: 12,
    justifyContent: "flex-end",
  },
  typeBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.65)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontWeight: "800",
    letterSpacing: 0.8,
    color: TEXT_ON_GRADIENT,
  },
  title: {
    color: TEXT_ON_GRADIENT,
    fontWeight: "800",
    fontSize: 16,
  },
  subtitle: {
    color: "rgba(11,18,32,0.75)",
    marginTop: 2,
    fontWeight: "600",
  },
});
