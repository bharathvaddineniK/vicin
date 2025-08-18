import Header from "@/components/Header";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
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
  Users,
} from "phosphor-react-native";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TileType =
  | "hero"
  | "category"
  | "trending"
  | "nearby"
  | "expiring"
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

const TRENDING_POSTS = [
  "Need jumper cables - Oak St",
  "Free moving boxes available",
  "Lost cat: orange tabby",
  "Yard sale Saturday 9AM",
  "Best vet recommendations?",
  "Water outage updates",
  "Book swap this Sunday",
];

const DEMO_DATA: BentoItem[][] = [
  // Row 1: Hero (Primary Green) + Trending (Secondary Green)
  [
    {
      id: "hero-update",
      type: "hero",
      category: "update",
      title: "Road Construction Update",
      subtitle: "Main St closed until Friday",
      width: 8,
      icon: Info,
      gradient: ["#4A7043", "#2D572C"] as const,
    },
    {
      id: "trending-now",
      type: "trending",
      title: "Trending Now",
      subtitle: "Most active posts",
      width: 4,
      icon: Fire,
      backgroundColor: "#2D572C",
      textColor: "#ffffff",
    },
  ],
  // Row 2: Light tiles with green borders (60% - main content)
  [
    {
      id: "help-category",
      type: "category",
      category: "help",
      title: "Community Help",
      subtitle: "12 active requests",
      width: 4,
      icon: HandHeart,
      backgroundColor: "#ffffff",
      textColor: "#1E3A1D",
      borderColor: "#6B8E66",
    },
    {
      id: "offers-category",
      type: "category",
      category: "offer",
      title: "Free Items",
      subtitle: "8 offers available",
      width: 4,
      icon: Users,
      backgroundColor: "#ffffff",
      textColor: "#1E3A1D",
      borderColor: "#6B8E66",
    },
    {
      id: "events-category",
      type: "category",
      category: "event",
      title: "Events",
      subtitle: "3 upcoming events",
      width: 4,
      icon: Calendar,
      backgroundColor: "#ffffff",
      textColor: "#1E3A1D",
      borderColor: "#6B8E66",
    },
  ],
  // Row 3: Highlight green + White with border (30% - secondary content)
  [
    {
      id: "nearby-posts",
      type: "nearby",
      title: "Near You",
      subtitle: "Within 0.5 miles",
      count: 24,
      width: 6,
      icon: MapPin,
      backgroundColor: "#A9CBA4",
      textColor: "#1E3A1D",
    },
    {
      id: "expiring-soon",
      type: "expiring",
      title: "Expiring Soon",
      subtitle: "Act fast!",
      count: 5,
      width: 6,
      icon: Clock,
      backgroundColor: "#ffffff",
      textColor: "#1E3A1D",
      borderColor: "#6B8E66",
    },
  ],
  // Row 4: White with border + Primary green (30% - secondary content)
  [
    {
      id: "questions-category",
      type: "category",
      category: "question",
      title: "Ask Community",
      subtitle: "15 recent questions",
      width: 8,
      icon: Question,
      backgroundColor: "#ffffff",
      textColor: "#1E3A1D",
      borderColor: "#6B8E66",
    },
    {
      id: "weekly-stats",
      type: "stats",
      title: "This Week",
      subtitle: "47 new posts",
      width: 4,
      icon: TrendUp,
      backgroundColor: "#4A7043",
      textColor: "#ffffff",
    },
  ],
  // Row 5: Light tiles with green borders (60% - main content)
  [
    {
      id: "top-helpers",
      type: "featured",
      title: "Top Helpers",
      subtitle: "Most helpful neighbors",
      width: 6,
      icon: Star,
      backgroundColor: "#ffffff",
      textColor: "#1E3A1D",
      borderColor: "#6B8E66",
    },
    {
      id: "new-neighbors",
      type: "featured",
      title: "New Neighbors",
      subtitle: "Welcome them!",
      count: 3,
      width: 6,
      icon: Users,
      backgroundColor: "#ffffff",
      textColor: "#1E3A1D",
      borderColor: "#6B8E66",
    },
  ],
  // Row 6: Mix of highlight and accent colors (10% - accent content)
  [
    {
      id: "lost-found",
      type: "category",
      title: "Lost & Found",
      subtitle: "2 active posts",
      width: 4,
      icon: MapPin,
      backgroundColor: "#A9CBA4",
      textColor: "#1E3A1D",
    },
    {
      id: "recommendations",
      type: "featured",
      title: "Recommendations",
      subtitle: "Trusted by neighbors",
      width: 4,
      icon: Star,
      backgroundColor: "#ffffff",
      textColor: "#1E3A1D",
      borderColor: "#6B8E66",
    },
    {
      id: "urgent-help",
      type: "category",
      title: "Urgent Help",
      subtitle: "Needs immediate attention",
      width: 4,
      icon: Clock,
      backgroundColor: "#2D572C",
      textColor: "#ffffff",
      borderColor: "#D4C2A6",
    },
  ],
];

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const padding = 16;
  const gap = 12;
  const availableWidth = width - padding * 2;

  // Animation for trending posts
  const slideAnim = useRef(new Animated.Value(0)).current;
  const currentPostIndex = useRef(0);

  useEffect(() => {
    const animateSlide = () => {
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        currentPostIndex.current =
          (currentPostIndex.current + 1) % TRENDING_POSTS.length;
        slideAnim.setValue(20);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    };

    const interval = setInterval(animateSlide, 2000);
    return () => clearInterval(interval);
  }, [slideAnim]);

  // Calculate tile width based on grid units (12 column system)
  const getTileWidth = (gridWidth: number) => {
    const totalGapsInRow = 12 / gridWidth - 1;
    return (availableWidth - gap * totalGapsInRow) / (12 / gridWidth);
  };

  const tileHeight = 120; // Same height for all tiles

  const BentoTile = ({ item }: { item: BentoItem }) => {
    const Icon = item.icon;
    const tileWidth = getTileWidth(item.width);

    // Tiles with gradients
    if (item.gradient) {
      return (
        <Pressable
          onPress={() => {
            if (item.category) {
              router.push(`/feed/${item.category}` as any);
            } else if (item.type === "trending") {
              router.push("/search" as any);
            }
          }}
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
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  padding: 6,
                }}
              >
                <Icon
                  size={item.width >= 8 ? 20 : 18}
                  weight="bold"
                  color="white"
                />
              </View>
              <Text
                style={{
                  color: "white",
                  fontSize: item.width >= 8 ? 12 : 10,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                UPDATES
              </Text>
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
                    color: "white",
                    fontSize: item.width >= 8 ? 18 : item.width >= 6 ? 16 : 15,
                    fontWeight: "800",
                    lineHeight:
                      item.width >= 8 ? 22 : item.width >= 6 ? 20 : 18,
                    marginBottom: 4,
                  }}
                >
                  {item.title}
                </Text>
                {item.subtitle && (
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.8)",
                      fontSize:
                        item.width >= 8 ? 14 : item.width >= 6 ? 13 : 12,
                      fontWeight: "500",
                    }}
                  >
                    {item.subtitle}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  color: "white",
                  fontSize: 16,
                  opacity: 0.8,
                  marginLeft: 8,
                }}
              >
                →
              </Text>
            </View>
          </LinearGradient>
        </Pressable>
      );
    }

    // Special trending tile with sliding posts
    if (item.type === "trending") {
      return (
        <Pressable
          onPress={() => router.push("/search" as any)}
          style={({ pressed }) => ({
            width: tileWidth,
            height: tileHeight,
            backgroundColor: item.backgroundColor,
            borderRadius: 16,
            padding: 16,
            justifyContent: "space-between",
            transform: [{ scale: pressed ? 0.97 : 1 }],
            shadowColor: "#2D572C",
            shadowOffset: { width: 0, height: pressed ? 1 : 2 },
            shadowOpacity: pressed ? 0.1 : 0.15,
            shadowRadius: pressed ? 3 : 6,
            elevation: pressed ? 1 : 3,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: 6,
              }}
            >
              <Icon size={16} weight="regular" color={item.textColor} />
            </View>
          </View>

          <View style={{ flex: 1, overflow: "hidden" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: item.textColor,
                  fontSize: 13,
                  fontWeight: "800",
                  flex: 1,
                }}
              >
                {item.title}
              </Text>
              <Text
                style={{
                  color: item.textColor,
                  fontSize: 14,
                  opacity: 0.8,
                  marginLeft: 4,
                }}
              >
                →
              </Text>
            </View>
            <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
              <Text
                style={{
                  color: item.textColor,
                  fontSize: 10,
                  fontWeight: "500",
                  opacity: 0.7,
                  lineHeight: 14,
                }}
                numberOfLines={2}
              >
                {TRENDING_POSTS[currentPostIndex.current]}
              </Text>
            </Animated.View>
          </View>
        </Pressable>
      );
    }

    // Tiles with solid colors and thin borders
    return (
      <Pressable
        onPress={() => {
          if (item.category) {
            router.push(`/feed/${item.category}` as any);
          }
        }}
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
          {item.count && (
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
                style={{
                  color: "#1E3A1D",
                  fontSize: 10,
                  fontWeight: "700",
                }}
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
                lineHeight: item.width >= 8 ? 20 : item.width >= 6 ? 18 : 16,
                marginBottom: 2,
              }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {item.subtitle && (
              <Text
                style={{
                  color: item.textColor,
                  fontSize: item.width >= 8 ? 13 : item.width >= 6 ? 12 : 11,
                  fontWeight: "500",
                  opacity: 0.7,
                }}
                numberOfLines={1}
              >
                {item.subtitle}
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
          >
            →
          </Text>
        </View>
      </Pressable>
    );
  };

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
          paddingBottom: 100,
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
              <BentoTile key={item.id} item={item} />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
