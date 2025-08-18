import Screen from "@/components/Screen";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

export default function CategoryFeed() {
  const { category } = useLocalSearchParams<{ category: string }>();

  const data = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        id: `demo-${i}`,
        title: `Post ${i + 1}`,
      })),
    [],
  );

  return (
    <Screen edges={["top"]}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>{category} feed</Text>
        <Text style={{ color: "#64748b", marginTop: 4 }}>
          Placeholder list (wired later)
        </Text>
      </View>

      <FlatList
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/post/${item.id}` as any)}
            style={({ pressed }) => ({
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#e5e7eb",
              borderRadius: 12,
              padding: 14,
              opacity: pressed ? 0.7 : 1,
            })}
            accessibilityLabel={`Open ${item.title}`}
          >
            <Text style={{ fontWeight: "700" }}>{item.title}</Text>
            <Text style={{ color: "#64748b" }}>Card preview…</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}
