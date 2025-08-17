// app/gate.tsx
import Screen from "@/components/Screen";
import { router } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

export default function GateScreen() {
  return (
    <Screen edges={["top"]}>
      <View
        style={{
          flex: 1,
          backgroundColor: "#f8fafc",
          padding: 20,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 18,
            gap: 12,
            borderWidth: 1,
            borderColor: "#e5e7eb",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "800", textAlign: "center" }}>
            Create an account to post
          </Text>
          <Text style={{ color: "#6b7280", textAlign: "center" }}>
            Posting, photos and video uploads require an account.
          </Text>

          <Pressable
            onPress={() => router.push("/(auth)/signup")}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              backgroundColor: "#2563eb",
              padding: 12,
              borderRadius: 12,
              alignItems: "center",
            })}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Create account</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(auth)/login")}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              padding: 12,
              borderRadius: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "#cbd5e1",
            })}
          >
            <Text style={{ fontWeight: "700" }}>Sign in</Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace("/(tabs)")}
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
              padding: 10,
              alignItems: "center",
            })}
          >
            <Text style={{ color: "#6b7280" }}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
