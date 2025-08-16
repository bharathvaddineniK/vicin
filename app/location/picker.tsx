// /app/location/picker.tsx
import { saveLocalOrigin } from "@/lib/geo";
import { supabase } from "@/lib/supabase";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";

async function storeForUserOrGuest(lat: number, lon: number) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    await supabase
      .from("profiles")
      .update({ home_location: `SRID=4326;POINT(${lon} ${lat})` })
      .eq("id", session.user.id);
  } else {
    await saveLocalOrigin({ lat, lon, radius_m: 8047, source: "manual" });
  }
}

export default function LocationPicker() {
  // Sunnyvale-ish default
  const [coord, setCoord] = useState<{ lat: number; lon: number }>({
    lat: 37.373,
    lon: -122.038,
  });

  function onRegionChange(r: Region) {
    setCoord({ lat: r.latitude, lon: r.longitude });
  }

  async function onConfirm() {
    await storeForUserOrGuest(coord.lat, coord.lon);
    router.replace("/(tabs)" as Href);
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: coord.lat,
          longitude: coord.lon,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onRegionChangeComplete={onRegionChange}
      >
        <Marker
          coordinate={{ latitude: coord.lat, longitude: coord.lon }}
          draggable
          onDragEnd={(e) =>
            setCoord({
              lat: e.nativeEvent.coordinate.latitude,
              lon: e.nativeEvent.coordinate.longitude,
            })
          }
        />
      </MapView>
      <View style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
        <Pressable
          onPress={onConfirm}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            backgroundColor: "#2563EB",
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
          })}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            Use this area
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace("/location/intro" as Href)}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            marginTop: 10,
            padding: 10,
            alignItems: "center",
          })}
        >
          <Text>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}
