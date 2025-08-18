import Screen from "@/components/Screen";
import { router } from "expo-router";
import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";

export default function SearchScreen() {
  const [q, setQ] = React.useState("");

  return (
    <Screen edges={["top"]}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>Search</Text>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search posts, hashtags…"
          placeholderTextColor="#94a3b8"
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#e5e7eb",
            padding: 12,
          }}
        />

        <Pressable
          onPress={() => router.push(`/feed/update` as any)} // temporary: route somewhere to prove nav
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            backgroundColor: "#2563eb",
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 12,
            opacity: pressed ? 0.7 : 1,
          })}
          accessibilityLabel="Submit search"
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>
            Search (stub)
          </Text>
        </Pressable>

        <Text style={{ color: "#64748b" }}>
          Results view will replace this in Atom 4.3.
        </Text>
      </View>
    </Screen>
  );
}
