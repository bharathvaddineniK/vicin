// /app/location/intro.tsx
import { saveLocalOrigin } from "@/lib/geo";
import { getOneShot, requestForeground } from "@/lib/location";
import { supabase } from "@/lib/supabase";
import { router, type Href } from "expo-router";
import { Alert, Linking, Pressable, Text, View } from "react-native";

async function storeForUserOrGuest(
  lat: number,
  lon: number,
  source: "gps" | "manual",
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    await supabase
      .from("profiles")
      .update({
        home_location: `SRID=4326;POINT(${lon} ${lat})`,
      })
      .eq("id", session.user.id);
  } else {
    await saveLocalOrigin({ lat, lon, radius_m: 8047, source });
  }
}

export default function LocationIntro() {
  async function onEnable() {
    const { granted } = await requestForeground();
    if (!granted) {
      router.replace("/location/picker" as Href);
      return;
    }
    try {
      const { latitude, longitude } = await getOneShot();
      await storeForUserOrGuest(latitude, longitude, "gps");
      router.replace("/(tabs)" as Href);
    } catch {
      Alert.alert("Location unavailable", "Choose your area on the map.");
      router.replace("/location/picker" as Href);
    }
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>See what’s nearby</Text>
      <Text style={{ color: "#475569" }}>
        Vicin uses your location only while you’re using the app to show local
        posts and pins. You can change this anytime.
      </Text>

      <Pressable
        onPress={onEnable}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          backgroundColor: "#2563EB",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        })}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>
          Enable location
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.replace("/location/picker" as Href)}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#CBD5E1",
          alignItems: "center",
        })}
      >
        <Text style={{ fontWeight: "600" }}>Choose on map</Text>
      </Pressable>

      <Pressable
        onPress={() => Linking.openSettings()}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          alignItems: "center",
          padding: 8,
        })}
      >
        <Text>Open device settings</Text>
      </Pressable>

      <Pressable
        onPress={() => router.replace("/(tabs)" as Href)}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          alignItems: "center",
          padding: 8,
        })}
      >
        <Text>Not now</Text>
      </Pressable>
    </View>
  );
}
