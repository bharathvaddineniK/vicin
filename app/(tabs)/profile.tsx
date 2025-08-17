import Screen from "@/components/Screen";
import { ensureMyProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileTab() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const p = await ensureMyProfile();
      setMe(p);
      setLoading(false);
    })();
  }, []);

  // Loading state
  if (loading) {
    const Body = (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
    return Platform.OS === "android" ? (
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {Body}
      </SafeAreaView>
    ) : (
      Body
    );
  }

  // Not signed in
  if (!me) {
    const Body = (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Not signed in.</Text>
      </View>
    );
    return Platform.OS === "android" ? (
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {Body}
      </SafeAreaView>
    ) : (
      Body
    );
  }

  // Main content (shared)
  const Content = (
    <Screen edges={["top"]}>
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 12,
            borderWidth: 1,
            borderColor: "#e5e7eb",
          }}
        >
          {me.avatar_url ? (
            <Image
              source={{ uri: me.avatar_url }}
              style={{ width: 64, height: 64, borderRadius: 32, marginRight: 12 }}
            />
          ) : (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                marginRight: 12,
                backgroundColor: "#e5e7eb",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontWeight: "800" }}>
                {(me.display_name?.[0] ?? "U").toUpperCase()}
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800" }}>{me.display_name}</Text>
            <Text style={{ color: "#64748b" }}>@{me.handle}</Text>
          </View>

          <Pressable
            onPress={() => router.push("/(onboarding)/profile" as Href)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#93c5fd",
              marginRight: 8,
            })}
          >
            <Text style={{ fontWeight: "700" }}>Edit</Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              try {
                await supabase.auth.signOut();
              } catch {}
              router.replace("/(auth)/login" as Href);
            }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#ef4444",
            })}
          >
            <Text style={{ fontWeight: "700", color: "#ef4444" }}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );

  // Android: SafeArea wrapper; iOS: no extra wrapper
  return Platform.OS === "android" ? (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
      {Content}
    </SafeAreaView>
  ) : (
    Content
  );
}
