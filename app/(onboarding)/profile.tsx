import { ensureMyProfile, isHandleAvailable } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { uploadImageFromUri } from "@/lib/upload";
import * as ImagePicker from "expo-image-picker";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const reHandle = /^[a-z0-9_]{3,20}$/;
const MI_TO_M = 1609.34;

function useDebounce<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function ProfileSetup() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleState, setHandleState] = useState<
    "idle" | "checking" | "ok" | "taken" | "invalid"
  >("idle");

  const [radiusMi, setRadiusMi] = useState("5");
  const [bio, setBio] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const debouncedHandle = useDebounce(handle.trim().toLowerCase(), 400);
  const checkingRef = useRef(0);
  const originalHandle = useRef<string>("");
  const myUserId = useRef<string>("");

  useEffect(() => {
    (async () => {
      try {
        const me = await ensureMyProfile();
        myUserId.current = me.id;
        originalHandle.current = (me.handle ?? "").toLowerCase();
        setHandle(me.handle ?? "");
        if (!me) {
          router.replace("/(auth)/login" as Href);
          return;
        }
        setDisplayName(me.display_name ?? "");
        setHandle(me.handle ?? "");
        if (me.home_radius_m)
          setRadiusMi(
            String(Math.max(1, Math.round(me.home_radius_m / MI_TO_M))),
          );
        setBio(me.bio ?? "");
        // avatarUri intentionally not prefilled
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "Couldn’t load your profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const current = ++checkingRef.current;
      const h = debouncedHandle;
      if (!h) {
        setHandleState("idle");
        return;
      }
      if (h === originalHandle.current) {
        setHandleState("ok"); // 👈 it's mine; treat as OK
        return;
      }
      if (!reHandle.test(h)) {
        setHandleState("invalid");
        return;
      }
      setHandleState("checking");
      const ok = await isHandleAvailable(h, myUserId.current); // 👈 exclude me
      setHandleState(ok ? "ok" : "taken");
      try {
        const ok = await isHandleAvailable(h);
        if (checkingRef.current !== current) return;
        setHandleState(ok ? "ok" : "taken");
      } catch {
        if (checkingRef.current !== current) return;
        setHandleState("invalid");
      }
    })();
  }, [debouncedHandle]);

  const canSave = useMemo(() => {
    const miles = Number(radiusMi);
    return (
      !saving &&
      displayName.trim().length >= 2 &&
      reHandle.test(handle.trim().toLowerCase()) &&
      handleState !== "taken" &&
      Number.isFinite(miles) &&
      miles > 0
    );
  }, [displayName, handle, handleState, radiusMi, saving]);

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled) setAvatarUri(res.assets[0].uri);
  }

  async function uploadAvatar(userId: string): Promise<string | null> {
    if (!avatarUri) return null;
    try {
      return await uploadImageFromUri(userId, avatarUri);
    } catch (e) {
      console.log("[Avatar] upload failed", e);
      return null;
    }
  }

  async function onSave() {
    try {
      if (!canSave) return;
      setSaving(true);

      const h = handle.trim().toLowerCase();
      const stillOk = await isHandleAvailable(h);
      if (!stillOk) {
        setHandleState("taken");
        Alert.alert("Handle taken", "Please choose another handle.");
        return;
      }

      const miles = Number(radiusMi);
      const radius_m = Math.max(1, Math.round(miles * MI_TO_M));

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in. Please login again.");

      const avatarUrl = await uploadAvatar(session.user.id);

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          handle: h,
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
          home_radius_m: radius_m,
        })
        .eq("id", session.user.id);

      if (error) throw error;

      // Go to app tabs; your Home will show the location modal if needed
      router.replace("/(tabs)" as Href);
    } catch (e: any) {
      console.log("[Onboarding] save failed:", e);
      Alert.alert("Couldn’t save profile", e?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#f8fafc",
        paddingHorizontal: 20,
        paddingBottom: 20,
      }}
    >
      {/* quick escape hatch */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          marginTop: 4,
        }}
      >
        <Pressable
          onPress={async () => {
            try {
              await supabase.auth.signOut();
            } catch {}
            router.replace("/(auth)/login" as Href);
          }}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ color: "#64748b" }}>Sign out</Text>
        </Pressable>
      </View>

      <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 16 }}>
        Create your profile
      </Text>

      {/* Avatar */}
      <Pressable
        onPress={pickAvatar}
        accessibilityRole="button"
        style={{ alignSelf: "center", marginBottom: 16 }}
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={{
              width: 108,
              height: 108,
              borderRadius: 54,
              borderWidth: 2,
              borderColor: "#e2e8f0",
            }}
          />
        ) : (
          <View
            style={{
              width: 108,
              height: 108,
              borderRadius: 54,
              backgroundColor: "#e2e8f0",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#475569" }}>Add photo</Text>
          </View>
        )}
      </Pressable>

      {/* Fields */}
      <View style={{ gap: 12 }}>
        <TextInput
          placeholder="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#e2e8f0",
            borderRadius: 12,
            padding: 14,
          }}
        />

        <View>
          <TextInput
            placeholder="Handle (lowercase, 3–20)"
            autoCapitalize="none"
            value={handle}
            onChangeText={(t) => {
              setHandle(t);
              setHandleState("idle");
            }}
            style={{
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#e2e8f0",
              borderRadius: 12,
              padding: 14,
            }}
          />
          <Text
            style={{
              marginTop: 6,
              height: 18,
              color:
                handleState === "taken" || handleState === "invalid"
                  ? "#ef4444"
                  : handleState === "ok"
                    ? "#16a34a"
                    : "#64748b",
            }}
          >
            {handle.length === 0
              ? ""
              : handleState === "invalid"
                ? "Use a–z, 0–9, _"
                : handleState === "checking"
                  ? "Checking…"
                  : handleState === "taken"
                    ? "Taken"
                    : "Available"}
          </Text>
        </View>

        <TextInput
          placeholder="Home radius in miles (e.g. 5)"
          keyboardType="numeric"
          value={radiusMi}
          onChangeText={setRadiusMi}
          style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#e2e8f0",
            borderRadius: 12,
            padding: 14,
          }}
        />

        <TextInput
          placeholder="Bio (optional)"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#e2e8f0",
            borderRadius: 12,
            padding: 14,
            minHeight: 80,
          }}
        />
      </View>

      <Pressable
        onPress={onSave}
        disabled={!canSave}
        style={({ pressed }) => ({
          opacity: pressed || !canSave ? 0.6 : 1,
          backgroundColor: "#2563eb",
          padding: 16,
          borderRadius: 14,
          alignItems: "center",
          marginTop: 20,
        })}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>
          {saving ? "Saving…" : "Continue"}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
