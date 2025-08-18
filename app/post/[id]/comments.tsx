import Screen from "@/components/Screen";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { FlatList, Text, View } from "react-native";

export default function CommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const data = React.useMemo(
    () =>
      Array.from({ length: 8 }).map((_, i) => ({
        id: `c-${i}`,
        text: `Comment ${i + 1}`,
      })),
    [],
  );

  return (
    <Screen edges={["top"]}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>Comments</Text>
        <Text style={{ color: "#64748b", marginTop: 4 }}>Post ID: {id}</Text>
      </View>

      <FlatList
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#e5e7eb",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Text style={{ fontWeight: "700" }}>{item.text}</Text>
            <Text style={{ color: "#64748b" }}>Reply placeholder…</Text>
          </View>
        )}
      />
    </Screen>
  );
}
