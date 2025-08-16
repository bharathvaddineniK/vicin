import { clearLocalOrigin, getLocalOrigin, saveLocalOrigin } from "@/lib/geo";
import { getOneShot, requestForeground } from "@/lib/location";
import { supabase } from "@/lib/supabase";
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MI_TO_M = 1609.34;

export default function Settings() {
  const [radiusMi, setRadiusMi] = useState("5");
  const [hasArea, setHasArea] = useState<boolean>(false);
  const [busy, setBusy] = useState<null | "gps" | "map" | "save" | "clear">(
    null,
  );

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data, error } = await supabase
          .from("profiles")
          .select("home_location, home_radius_m")
          .eq("id", session.user.id)
          .single();
        if (!error && data) {
          setHasArea(!!data.home_location);
          if (data.home_radius_m)
            setRadiusMi(
              String(Math.max(1, Math.round(data.home_radius_m / MI_TO_M))),
            );
        }
      } else {
        const local = await getLocalOrigin();
        setHasArea(!!local);
        if (local?.radius_m)
          setRadiusMi(
            String(Math.max(1, Math.round(local.radius_m / MI_TO_M))),
          );
      }
    })();
  }, []);

  async function useCurrentLocation() {
    setBusy("gps");
    try {
      const { granted } = await requestForeground();
      if (!granted) {
        Alert.alert(
          "Permission needed",
          "Turn on location in device settings to use current location.",
          [
            { text: "Open Settings", onPress: () => Linking.openSettings() },
            { text: "Cancel", style: "cancel" },
          ],
        );
        return;
      }
      const { latitude, longitude } = await getOneShot();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from("profiles")
          .update({
            home_location: `SRID=4326;POINT(${longitude} ${latitude})`,
          })
          .eq("id", session.user.id);
      } else {
        const r = Math.max(1, Math.round(Number(radiusMi) * MI_TO_M));
        await saveLocalOrigin({
          lat: latitude,
          lon: longitude,
          radius_m: r,
          source: "gps",
        });
      }
      setHasArea(true);
      Alert.alert("Saved", "Your home area has been updated.");
    } catch (e: any) {
      Alert.alert("Couldn’t get location", e?.message ?? "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function chooseOnMap() {
    setBusy("map");
    router.push("/location/picker" as Href);
    // When returning, Home refetches profile/local origin already.
    setBusy(null);
  }

  async function saveRadius() {
    setBusy("save");
    try {
      const r = Math.max(1, Math.round(Number(radiusMi) * MI_TO_M));
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from("profiles")
          .update({ home_radius_m: r })
          .eq("id", session.user.id);
      } else {
        const local = await getLocalOrigin();
        if (local)
          await saveLocalOrigin({
            ...local,
            radius_m: r,
            source: local.source ?? "manual",
          });
      }
      Alert.alert("Saved", "Home radius updated.");
    } finally {
      setBusy(null);
    }
  }

  async function clearArea() {
    setBusy("clear");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from("profiles")
          .update({ home_location: null })
          .eq("id", session.user.id);
      } else {
        await clearLocalOrigin();
      }
      setHasArea(false);
      Alert.alert("Cleared", "Home area removed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>
        Privacy & Location
      </Text>

      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 14,
          padding: 14,
          borderWidth: 1,
          borderColor: "#e5e7eb",
          gap: 10,
        }}
      >
        <Text style={{ fontWeight: "700" }}>Home area</Text>
        <Text style={{ color: "#64748b" }}>
          {hasArea ? "Set" : "Not set"} · This powers your local feed and
          alerts.
        </Text>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <Pressable
            onPress={useCurrentLocation}
            disabled={busy === "gps"}
            style={({ pressed }) => ({
              opacity: pressed || busy === "gps" ? 0.6 : 1,
              backgroundColor: "#2563EB",
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
            })}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {busy === "gps" ? "Getting…" : "Use current location"}
            </Text>
          </Pressable>

          <Pressable
            onPress={chooseOnMap}
            disabled={busy === "map"}
            style={({ pressed }) => ({
              opacity: pressed || busy === "map" ? 0.6 : 1,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#93c5fd",
            })}
          >
            <Text style={{ fontWeight: "700" }}>
              {busy === "map" ? "Opening…" : "Choose on map"}
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
          }}
        >
          <TextInput
            keyboardType="numeric"
            value={radiusMi}
            onChangeText={setRadiusMi}
            placeholder="Miles"
            style={{
              flex: 0,
              width: 100,
              backgroundColor: "#f8fafc",
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#e2e8f0",
              padding: 10,
            }}
          />
          <Pressable
            onPress={saveRadius}
            disabled={busy === "save"}
            style={({ pressed }) => ({
              opacity: pressed || busy === "save" ? 0.6 : 1,
              backgroundColor: "#2563EB",
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
            })}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {busy === "save" ? "Saving…" : "Save radius"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={clearArea}
          disabled={busy === "clear"}
          style={({ pressed }) => ({
            opacity: pressed || busy === "clear" ? 0.6 : 1,
            paddingVertical: 10,
            borderRadius: 10,
            marginTop: 6,
            backgroundColor: "#fef2f2",
            borderWidth: 1,
            borderColor: "#fecaca",
          })}
        >
          <Text
            style={{ color: "#b91c1c", fontWeight: "700", textAlign: "center" }}
          >
            {busy === "clear" ? "Clearing…" : "Clear saved area"}
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 14,
          padding: 14,
          borderWidth: 1,
          borderColor: "#e5e7eb",
          gap: 10,
        }}
      >
        <Text style={{ fontWeight: "700" }}>Device permission</Text>
        <Text style={{ color: "#64748b" }}>
          You can change OS permission anytime. If you previously denied on iOS,
          re‑enable here.
        </Text>
        <Pressable
          onPress={() => Linking.openSettings()}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            backgroundColor: "#111827",
            paddingVertical: 10,
            borderRadius: 10,
          })}
        >
          <Text
            style={{ color: "#fff", fontWeight: "700", textAlign: "center" }}
          >
            Open device settings
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
