import Screen from "@/components/Screen";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen edges={["top"]}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>Post</Text>
        <Text style={{ color: "#64748b" }}>ID: {id}</Text>

        <View
          style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>
            Post body (placeholder)
          </Text>
          <Text style={{ color: "#64748b" }}>
            Full media & actions come later.
          </Text>
        </View>

        <Pressable
          onPress={() => router.push(`/post/${id}/comments` as any)}
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#93c5fd",
            backgroundColor: "#fff",
            opacity: pressed ? 0.6 : 1,
          })}
          accessibilityLabel="Open comments"
        >
          <Text style={{ fontWeight: "700" }}>Open comments</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
