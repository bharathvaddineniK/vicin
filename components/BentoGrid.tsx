// components/BentoGrid.tsx
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useRef } from "react";
import {
  Animated,
  ColorValue,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

/** Gradient type: 2+ ColorValues, readonly (matches LinearGradient.colors) */
type GradientStops = readonly [ColorValue, ColorValue, ...ColorValue[]];

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * Public types for reusable, explicit rows (rows path)
 * ──────────────────────────────────────────────────────────────────────────────
 */
type GridCols = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type GridCategory = "update" | "question" | "help" | "offer" | "event";
export type GridVariant =
  | "hero"
  | "category"
  | "trending"
  | "nearby"
  | "expiring"
  | "stats"
  | "featured"
  | "cta";

export type GridTile = {
  id: string;
  title?: string;
  subtitle?: string;
  /** 12‑column grid widths only */
  width: GridCols;
  variant: GridVariant;
  category?: GridCategory;

  /** Visuals (optional) */
  gradient?: GradientStops;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  icon?: React.ReactNode;

  /** Action */
  onPress?: () => void;

  /** A11y */
  accessibilityLabel?: string;
};

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * Legacy demo API (kept intact for backward compatibility)
 * ──────────────────────────────────────────────────────────────────────────────
 */
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
  /** Legacy path */
  items?: BentoTile[];
  onPressTile?: (t: BentoTile) => void;

  /** Rows path */
  rows?: GridTile[][];

  /** Layout */
  gap?: number;
  padding?: number;
  tileHeight?: number;
};

// ---- Theme (legacy path) ----
const RAD = 16;
const GAP = 12;
const PAD = 12;

const TYPE_GRADIENTS: Record<PostType, GradientStops> = {
  update: ["#4A7043", "#2D572C"] as const,
  question: ["#6EE7B7", "#3B82F6"] as const,
  help: ["#FCA5A5", "#FB7185"] as const,
  offer: ["#FDE68A", "#F59E0B"] as const,
  event: ["#93C5FD", "#6366F1"] as const,
};

const TEXT_ON_GRADIENT = "#ffffff";
const GLASS = "rgba(255,255,255,0.2)";

// ---- Demo items (legacy placeholder) ----
const DEMO: BentoTile[] = Array.from({ length: 40 }).map((_, i) => {
  const types: PostType[] = ["update", "question", "help", "offer", "event"];
  const cycle: TileKind[] = ["hero", "medium", "small", "medium", "small", "medium", "banner"];
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

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * Legacy Tile (kept for backward compatibility)
 * ──────────────────────────────────────────────────────────────────────────────
 */
const LegacyTile = React.memo(function LegacyTile({
  cols,
  height,
  tile,
  onPress,
}: {
  cols: number; // 1..12 (flex share)
  height: number;
  tile: BentoTile;
  onPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }).start();

  const gradient = TYPE_GRADIENTS[tile.type];

  return (
    <View style={{ flex: cols }}>
      <Animated.View
        style={{
          height,
          transform: [{ scale }],
          borderRadius: RAD,
          overflow: "hidden",
          shadowColor: "#2D572C",
          shadowOpacity: 0.15,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
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
          accessibilityLabel={tile.title ? `${tile.type}: ${tile.title}` : tile.type}
        >
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
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

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * Row Tile (rows path) — Clean design matching your provided layout
 * ──────────────────────────────────────────────────────────────────────────────
 */
const RowTile = React.memo(function RowTile({
  tile,
  height,
}: {
  tile: GridTile;
  height: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }).start();

  const hasGradient = !!tile.gradient;

  // Clean color scheme matching your design
  const bg = tile.backgroundColor ?? (hasGradient ? undefined : "#ffffff");
  const textColor = tile.textColor ?? (hasGradient ? "#ffffff" : "#1E3A1D");
  const effectiveBorder =
    tile.borderColor ?? (!hasGradient && bg === "#ffffff" ? "#6B8E66" : "transparent");

  // Badges for hero & trending tiles
  const showBadge = tile.variant === "hero" || tile.variant === "trending";
  const badgeLabel =
    tile.variant === "trending"
      ? "TRENDING"
      : tile.category
      ? tile.category.toUpperCase()
      : "UPDATES";

  // Icon background matching your design
  const iconBg =
    bg === "#ffffff"
      ? "#F0F4F0"
      : effectiveBorder !== "transparent"
      ? `${effectiveBorder}20`
      : textColor === "#ffffff"
      ? "rgba(255,255,255,0.1)"
      : "rgba(0,0,0,0.05)";

  const titleSize = tile.width >= 8 ? 18 : tile.width >= 6 ? 16 : 15;
  const subtitleSize = tile.width >= 8 ? 14 : tile.width >= 6 ? 13 : 12;

  const Container = ({ children }: { children: React.ReactNode }) => (
    <Animated.View
      style={[
        styles.tileBase,
        {
          height,
          transform: [{ scale }],
          borderRadius: RAD,
        },
      ]}
    >
      <Pressable
        onPress={tile.onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
        style={{ flex: 1, overflow: "hidden", borderRadius: RAD }}
        accessibilityRole="button"
        accessibilityLabel={
          tile.accessibilityLabel ??
          [tile.variant?.toString(), tile.category ? ` ${tile.category}` : "", tile.title ? `: ${tile.title}` : ""].join(
            ""
          )
        }
      >
        {hasGradient ? (
          <LinearGradient colors={tile.gradient!} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
            <View style={styles.glass} />
            {children}
          </LinearGradient>
        ) : (
          <View
            style={{
              flex: 1,
              backgroundColor: bg,
              borderWidth: effectiveBorder !== "transparent" ? 1 : 0,
              borderColor: effectiveBorder,
            }}
          >
            {children}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={{ flex: tile.width }}>
      <Container>
        <View style={[styles.rowTileInner, { padding: tile.width >= 8 ? 20 : 16 }]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {tile.icon ? (
              <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                {tile.icon}
              </View>
            ) : null}
            {showBadge ? (
              <Text
                style={[
                  styles.badgeText,
                  { color: hasGradient ? "#ffffff" : textColor, opacity: hasGradient ? 0.9 : 0.8 },
                ]}
                numberOfLines={1}
              >
                {badgeLabel}
              </Text>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              {!!tile.title && (
                <Text
                  numberOfLines={2}
                  style={[styles.titleText, { color: hasGradient ? "#ffffff" : textColor, fontSize: titleSize }]}
                >
                  {tile.title}
                </Text>
              )}
              {!!tile.subtitle && (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.subtitleText,
                    {
                      color: hasGradient ? "rgba(255,255,255,0.8)" : textColor,
                      opacity: hasGradient ? 0.9 : 0.7,
                      fontSize: subtitleSize,
                    },
                  ]}
                >
                  {tile.subtitle}
                </Text>
              )}
            </View>

            <Text
              style={{ color: hasGradient ? "#ffffff" : textColor, opacity: 0.6, marginLeft: 8, fontSize: 16 }}
              accessible={false}
            >
              →
            </Text>
          </View>
        </View>
      </Container>
    </View>
  );
});

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * Main Component
 * ──────────────────────────────────────────────────────────────────────────────
 */
export default function BentoGrid({
  items,
  onPressTile,
  rows,
  gap = GAP,
  padding = PAD,
  tileHeight = 120,
}: Props) {
  // Path A: explicit rows (your new layout)
  if (rows && rows.length) {
    const normalized = useMemo(() => rows, [rows]);

    return (
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: padding,
          paddingTop: padding,
          paddingBottom: padding,
        }}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
      >
        {normalized.map((row, rowIndex) => (
          <View key={`explicit-row-${rowIndex}`} style={[styles.row, { gap, marginBottom: gap }]}>
            {row.map((tile) => (
              <RowTile key={tile.id} tile={tile} height={tileHeight} />
            ))}
          </View>
        ))}
      </ScrollView>
    );
  }

  // Path B: legacy demo layout (kept for backward compatibility)
  const H_SMALL = 118;
  const H_MED = 160;
  const H_BANNER = 152;
  const H_LARGE = H_MED + gap + H_SMALL;
  const data = useMemo(() => (items && items.length ? items : DEMO), [items]);

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
      showsVerticalScrollIndicator={false}
    >
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
            <View style={[styles.row, { gap, marginBottom: gap }]}>
              <LegacyTile cols={8} height={H_LARGE} tile={r1_large} onPress={() => onPressTile?.(r1_large)} />
              <View style={{ flex: 4, gap }}>
                <LegacyTile cols={4} height={H_MED} tile={r1_med} onPress={() => onPressTile?.(r1_med)} />
                <LegacyTile cols={4} height={H_SMALL} tile={r1_small} onPress={() => onPressTile?.(r1_small)} />
              </View>
            </View>

            <View style={[styles.row, { gap, marginBottom: gap }]}>
              <LegacyTile cols={4} height={H_MED} tile={r2_m1} onPress={() => onPressTile?.(r2_m1)} />
              <LegacyTile cols={4} height={H_MED} tile={r2_m2} onPress={() => onPressTile?.(r2_m2)} />
              <LegacyTile cols={4} height={H_MED} tile={r2_m3} onPress={() => onPressTile?.(r2_m3)} />
            </View>

            <View style={[styles.row, { gap, marginBottom: gap }]}>
              <LegacyTile cols={3} height={H_SMALL} tile={r3_s1} onPress={() => onPressTile?.(r3_s1)} />
              <LegacyTile cols={6} height={H_SMALL} tile={r3_large} onPress={() => onPressTile?.(r3_large)} />
              <LegacyTile cols={3} height={H_SMALL} tile={r3_s2} onPress={() => onPressTile?.(r3_s2)} />
            </View>

            <View style={{ marginBottom: gap }}>
              <View style={[styles.row, { gap }]}>
                <LegacyTile cols={12} height={H_BANNER} tile={r4_banner} onPress={() => onPressTile?.(r4_banner)} />
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * Styles
 * ──────────────────────────────────────────────────────────────────────────────
 */
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
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontWeight: "600",
    letterSpacing: 0.5,
    color: TEXT_ON_GRADIENT,
    fontSize: 10,
    textTransform: "uppercase",
  },
  title: {
    color: TEXT_ON_GRADIENT,
    fontWeight: "800",
    fontSize: 16,
  },
  subtitle: {
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
    fontWeight: "500",
  },

  // Row tiles (your new layout)
  tileBase: {
    borderRadius: RAD,
    overflow: "hidden",
    shadowColor: "#2D572C",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  rowTileInner: {
    flex: 1,
    justifyContent: "space-between",
  },
  iconWrap: {
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
  },
  badgeText: {
    fontWeight: "600",
    letterSpacing: 0.5,
    fontSize: 10,
    textTransform: "uppercase",
  },
  titleText: {
    fontWeight: "800",
    lineHeight: 20,
  },
  subtitleText: {
    fontWeight: "500",
    marginTop: 2,
  },
});
