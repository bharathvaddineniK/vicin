import { getOneShot } from "@/lib/location";
import { uploadPostAssetWithProgress } from "@/lib/media";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { nanoid } from "nanoid/non-secure";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

/* ---------- types ---------- */
const TYPES = [
  { key: "update", label: "Update" },
  { key: "alert", label: "Alert" },
  { key: "question", label: "Question" },
  { key: "help", label: "Help" },
  { key: "offer", label: "Offer" },
  { key: "event", label: "Event" },
] as const;
type PostType = (typeof TYPES)[number]["key"];

type UploadingItem = {
  id: string;
  kind: "image" | "video";
  status: "uploading";
  localUri: string;
};
type DoneItem = {
  id: string;
  kind: "image" | "video";
  status: "done";
  url: string;
};
type MediaItem = UploadingItem | DoneItem;

const EXPIRY = [
  { key: "6h", label: "6 hrs", hours: 6 },
  { key: "24h", label: "24 hrs", hours: 24 },
  { key: "48h", label: "48 hrs", hours: 48 },
  { key: "7d", label: "7 days", hours: 7 * 24 },
  { key: "none", label: "No expiry", hours: null },
] as const;

const DEFAULT_EXP: (typeof EXPIRY)[number] = EXPIRY[2];

/* ---------- shimmer ---------- */
function Shimmer({ style }: { style: any }) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[{ backgroundColor: "#e5e7eb" }, style, { opacity }]}
    />
  );
}

// format the badge consistently
function expiryBadge(exp: { key: string; label: string }) {
  if (exp.key === "none") return "No expiry";
  return `Expires in ${exp.label}`;
}

/* ---------- screen ---------- */
export default function CreatePost() {
  const { session, isGuest, loading } = useSession();
  const blocked = !loading && (isGuest || !session); // ← guests cannot interact
  console.log("blocked: ", blocked);

  const [showGate, setShowGate] = useState(false);
  // caps
  const MAX_DAYS_EVENT = 90;
  const MAX_DAYS_OTHER = 30;

  const [showCustom, setShowCustom] = useState(false);
  const [customDays, setCustomDays] = useState("");

  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<PostType>("update");
  const [expiry, setExpiry] = useState<(typeof EXPIRY)[number]>(DEFAULT_EXP);
  const [selectedKey, setSelectedKey] = useState<string>(DEFAULT_EXP.key);
  const [callEnabled, setCallEnabled] = useState(false);

  // unified list – placeholders (uploading) or final items (done)
  const [media, setMedia] = useState<MediaItem[]>([]);

  const [busy, setBusy] = useState(false);
  const [customHours, setCustomHours] = useState("");

  const imgCount = media.filter((m) => m.kind === "image").length;
  const hasVideo = media.some((m) => m.kind === "video");
  const hasInFlight = media.some((m) => m.status === "uploading");

  const remaining = 250 - content.length;
  const canPost =
    !busy &&
    !hasInFlight &&
    content.trim().length >= 1 &&
    content.trim().length <= 250;

  const coarseTypeFor = (
    t: PostType,
  ): "update" | "event" | "question" | "help" => {
    switch (t) {
      case "event":
        return "event";
      case "question":
        return "question";
      case "help":
        return "help";
      default:
        return "update";
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (blocked) setShowGate(true);
      return () => {};
    }, [blocked]),
  );

  useEffect(() => {
    if (!loading && session && !isGuest) setShowGate(false);
  }, [loading, session, isGuest]);

  /* ---------- pickers ---------- */
  async function addImages() {
    if (imgCount >= 5)
      return Alert.alert("Limit reached", "You can add up to 5 images.");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;

    const remainingSlots = 5 - imgCount;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: remainingSlots,
    });
    if (res.canceled) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session)
      return Alert.alert("Sign in required", "Guests can’t upload.");

    const placeholders: UploadingItem[] = res.assets
      .slice(0, remainingSlots)
      .map((a) => ({
        id: nanoid(),
        kind: "image",
        status: "uploading",
        localUri: a.uri,
      }));
    setMedia((prev) => [...prev, ...placeholders]);

    for (const ph of placeholders) {
      try {
        const up = await uploadPostAssetWithProgress(
          session.user.id,
          ph.localUri,
          Date.now(),
          () => {},
        );
        setMedia((prev) =>
          prev.map((m) =>
            m.id === ph.id
              ? { id: ph.id, kind: "image", status: "done", url: up.url }
              : m,
          ),
        );
      } catch {
        setMedia((prev) => prev.filter((m) => m.id !== ph.id));
        Alert.alert("Upload failed", "One image could not be uploaded.");
      }
    }
  }

  async function addVideo() {
    if (hasVideo) return Alert.alert("Limit", "Only one video is allowed.");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      quality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });
    if (res.canceled) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session)
      return Alert.alert("Sign in required", "Guests can’t upload.");

    const ph: UploadingItem = {
      id: nanoid(),
      kind: "video",
      status: "uploading",
      localUri: res.assets[0].uri,
    };
    setMedia((prev) => [...prev, ph]);

    try {
      const up = await uploadPostAssetWithProgress(
        session.user.id,
        ph.localUri,
        Date.now(),
        () => {},
      );
      setMedia((prev) =>
        prev.map((m) =>
          m.id === ph.id
            ? { id: ph.id, kind: "video", status: "done", url: up.url }
            : m,
        ),
      );
    } catch {
      setMedia((prev) => prev.filter((m) => m.id !== ph.id));
      Alert.alert("Upload failed", "The video could not be uploaded.");
    }
  }

  function removeMedia(id: string) {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }

  /* ---------- submit ---------- */
  async function submit() {
    if (!canPost) return;
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session)
        return Alert.alert("Sign in required", "Guests can’t post.");

      const { latitude, longitude } = await getOneShot();
      const expires_at = expiry.hours
        ? new Date(Date.now() + expiry.hours * 3600_000).toISOString()
        : null;

      const fine = (postType ?? "update") as PostType;
      const coarse = coarseTypeFor(fine);

      // Create post via RPC (geo + constraints)
      const { data: newId, error: rpcErr } = await supabase.rpc(
        "create_post_geog",
        {
          _content: content.trim(),
          _post_type: fine,
          _type: coarse,
          _call_enabled: callEnabled,
          _expires_at: expires_at,
          _lat: latitude,
          _lng: longitude,
        },
      );
      if (rpcErr) throw rpcErr;

      // Attach media to junction + mirror to posts.media
      const done = media.filter((m) => m.status === "done") as DoneItem[];
      if (done.length) {
        const rows = done.map((m) => ({
          post_id: newId as string,
          kind: m.kind,
          url: m.url,
        }));
        const { error: mErr } = await supabase.from("post_media").insert(rows);
        if (mErr) throw mErr;

        const { error: jErr } = await supabase
          .from("posts")
          .update({
            media: rows.map((r) => ({ kind: r.kind, url: r.url })) as any,
          })
          .eq("id", newId as string);
        if (jErr) throw jErr;
      }

      // reset form
      setContent("");
      setMedia([]);
      setPostType("update");
      setCallEnabled(false);

      const def = DEFAULT_EXP;
      setExpiry(def);
      setSelectedKey(def.key);
      setCustomDays("");
      setShowCustom(false);

      Alert.alert("Posted!", "Your post is live.");
    } catch (e: any) {
      Alert.alert("Couldn’t post", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------- render ---------- */
  const imageItems = media.filter((m) => m.kind === "image");
  const videoItem = media.find((m) => m.kind === "video");

  console.log("video: ", videoItem);
  console.log("images: ", imageItems);

  if (loading)
    return <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }} />;

  // if (blocked) {
  //     // 🔒 No post UI at all — just the gate modal
  //     return (
  //         <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}>
  //             <Modal
  //                 visible={showGate}
  //                 transparent
  //                 animationType="fade"
  //                 onRequestClose={() => setShowGate(false)}
  //             >
  //                 <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
  //                     <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 18, gap: 12 }}>
  //                         <Text style={{ fontSize: 18, fontWeight: "800", textAlign: "center" }}>
  //                             Create an account to post
  //                         </Text>
  //                         <Text style={{ color: "#6b7280", textAlign: "center" }}>
  //                             Posting, photos and video uploads require an account.
  //                         </Text>

  //                         <Pressable
  //                             onPress={() => { setShowGate(false); router.replace("/(auth)/signup"); }}
  //                             style={({ pressed }) => ({
  //                                 opacity: pressed ? 0.7 : 1, backgroundColor: "#2563eb",
  //                                 padding: 12, borderRadius: 12, alignItems: "center"
  //                             })}
  //                         >
  //                             <Text style={{ color: "#fff", fontWeight: "700" }}>Create account</Text>
  //                         </Pressable>
  //                         <Pressable
  //                             onPress={() => { setShowGate(false); router.replace("/(auth)/login"); }}
  //                             style={({ pressed }) => ({
  //                                 opacity: pressed ? 0.7 : 1, padding: 12, borderRadius: 12,
  //                                 alignItems: "center", borderWidth: 1, borderColor: "#cbd5e1"
  //                             })}
  //                         >
  //                             <Text style={{ fontWeight: "700" }}>Sign in</Text>
  //                         </Pressable>
  //                         <Pressable
  //                             onPress={() => { setShowGate(false); router.replace("/(tabs)"); }}
  //                             style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 10, alignItems: "center" })}
  //                         >
  //                             <Text style={{ color: "#6b7280" }}>Not now</Text>
  //                         </Pressable>
  //                     </View>
  //                 </View>
  //             </Modal>
  //         </SafeAreaView>
  //     );
  // }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* Guest gate modal */}
      <Modal
        visible={showGate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGate(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 18,
              gap: 12,
            }}
          >
            <Text
              style={{ fontSize: 18, fontWeight: "800", textAlign: "center" }}
            >
              Create an account to post
            </Text>
            <Text style={{ color: "#6b7280", textAlign: "center" }}>
              Posting, photos and video uploads require an account.
            </Text>
            <Pressable
              onPress={() => {
                setShowGate(false);
                router.push("/(auth)/signup");
              }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                backgroundColor: "#2563eb",
                padding: 12,
                borderRadius: 12,
                alignItems: "center",
              })}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                Create account
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowGate(false);
                router.push("/(auth)/login");
              }}
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
              onPress={() => {
                setShowGate(false);
                router.replace("/(tabs)");
              }}
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
      </Modal>

      <View style={{ flex: 1 }}>
        {/* Transparent blocker when guest: tapping opens the modal */}
        {blocked && (
          <Pressable
            onPress={() => setShowGate(true)}
            style={{ position: "absolute", inset: 0, zIndex: 10 }}
          />
        )}

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          // disable touch to underlying content while blocked
          pointerEvents={blocked ? "none" : "auto"}
        >
          <Text style={{ fontSize: 22, fontWeight: "800" }}>New post</Text>

          {/* Type chips */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TYPES.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setPostType(t.key)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: postType === t.key ? "#2563eb" : "#e5e7eb",
                })}
              >
                <Text
                  style={{
                    color: postType === t.key ? "#fff" : "#111827",
                    fontWeight: "700",
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Content */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: "#e5e7eb",
            }}
          >
            <TextInput
              placeholder="What’s up? Add #hashtags and links here…"
              value={content}
              onChangeText={(t) => {
                if (t.length <= 250) setContent(t);
              }}
              multiline
              textAlignVertical="top"
              style={{ minHeight: 120 }}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 6,
              }}
            >
              <Text style={{ color: remaining < 0 ? "#ef4444" : "#64748b" }}>
                {remaining} / 250
              </Text>
              <Text style={{ color: "#94a3b8" }}>Keep it short & clear</Text>
            </View>
          </View>

          {/* Pickers */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={addImages}
              disabled={imgCount >= 5}
              style={({ pressed }) => ({
                opacity: pressed || imgCount >= 5 ? 0.6 : 1,
                borderWidth: 1,
                borderColor: "#93c5fd",
                backgroundColor: "#fff",
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
              })}
            >
              <Text style={{ fontWeight: "700" }}>
                Add images ({imgCount}/5)
              </Text>
            </Pressable>
            <Pressable
              onPress={addVideo}
              disabled={hasVideo}
              style={({ pressed }) => ({
                opacity: pressed || hasVideo ? 0.6 : 1,
                borderWidth: 1,
                borderColor: "#93c5fd",
                backgroundColor: "#fff",
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
              })}
            >
              <Text style={{ fontWeight: "700" }}>
                {hasVideo ? "Video added" : "Add video (1)"}
              </Text>
            </Pressable>
          </View>

          {/* IMAGES row */}
          {imageItems.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {imageItems.map((item) =>
                item.status === "uploading" ? (
                  <Shimmer
                    key={item.id}
                    style={{ width: 96, height: 96, borderRadius: 12 }}
                  />
                ) : (
                  <View key={item.id} style={{ position: "relative" }}>
                    <Image
                      source={{ uri: (item as DoneItem).url }}
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "#e5e7eb",
                      }}
                    />
                    <Pressable
                      onPress={() => removeMedia(item.id)}
                      hitSlop={10}
                      style={({ pressed }) => ({
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 24,
                        height: 24,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,
                        backgroundColor: pressed
                          ? "rgba(0,0,0,0.5)"
                          : "rgba(0,0,0,0.35)",
                      })}
                    >
                      <Text style={{ color: "#fff", fontWeight: "800" }}>
                        ×
                      </Text>
                    </Pressable>
                  </View>
                ),
              )}
            </ScrollView>
          )}

          {/* VIDEO full width below images */}
          {videoItem && (
            <View
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: 10,
                gap: 8,
              }}
            >
              <Text style={{ fontWeight: "700" }}>Video</Text>
              {videoItem.status === "uploading" ? (
                <Shimmer
                  style={{ width: "100%", height: 180, borderRadius: 10 }}
                />
              ) : (
                <Video
                  source={{ uri: (videoItem as DoneItem).url }}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                  style={{ width: "100%", height: 180, borderRadius: 10 }}
                />
              )}
              <Pressable onPress={() => removeMedia(videoItem.id)}>
                <Text style={{ color: "#ef4444", fontWeight: "700" }}>
                  Remove video
                </Text>
              </Pressable>
            </View>
          )}

          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              gap: 12,
            }}
          >
            <Text style={{ fontWeight: "800" }}>Visibility</Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                { key: "6h", label: "6 hrs", hours: 6 },
                { key: "12h", label: "12 hrs", hours: 12 },
                { key: "24h", label: "24 hrs", hours: 24 },
                { key: "48h", label: "48 hrs", hours: 48 },
                {
                  key: "none",
                  label: "No expiry",
                  hours: null as number | null,
                },
              ].map((e) => (
                <Pressable
                  key={e.key}
                  onPress={() => {
                    setSelectedKey(e.key);
                    setShowCustom(false); // hide custom panel if open
                    setExpiry({
                      key: e.key as any,
                      label: e.label,
                      hours: e.hours,
                    } as any);
                  }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor:
                      selectedKey === e.key ? "#2563eb" : "#e5e7eb",
                  })}
                >
                  <Text
                    style={{
                      color: selectedKey === e.key ? "#fff" : "#111827",
                      fontWeight: "700",
                    }}
                  >
                    {e.label}
                  </Text>
                </Pressable>
              ))}

              {/* Custom in days */}
              <Pressable
                onPress={() => {
                  setSelectedKey("custom");
                  setShowCustom(true);
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor:
                    selectedKey === "custom" ? "#2563eb" : "#e5e7eb",
                })}
              >
                <Text
                  style={{
                    color: selectedKey === "custom" ? "#fff" : "#111827",
                    fontWeight: "700",
                  }}
                >
                  Custom…
                </Text>
              </Pressable>
            </View>

            {/* tiny helper under chips */}
            <Text style={{ color: "#94a3b8", marginTop: 4 }}>
              {postType === "event"
                ? "Custom max: 90 days"
                : "Custom max: 30 days"}
            </Text>

            {/* Custom days inline panel */}
            {showCustom && (
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  padding: 12,
                }}
              >
                <Text style={{ fontWeight: "800", marginBottom: 6 }}>
                  Custom expiry
                </Text>
                <TextInput
                  placeholder="Days (e.g. 7)"
                  keyboardType="numeric"
                  value={customDays}
                  onChangeText={setCustomDays}
                  style={{
                    backgroundColor: "#f8fafc",
                    borderWidth: 1,
                    borderColor: "#e2e8f0",
                    borderRadius: 10,
                    padding: 10,
                  }}
                />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <Pressable
                    onPress={() => {
                      const raw = Number(customDays);
                      if (!Number.isFinite(raw) || raw <= 0) {
                        return Alert.alert(
                          "Invalid",
                          "Enter a positive number of days.",
                        );
                      }
                      const cap =
                        postType === "event" ? MAX_DAYS_EVENT : MAX_DAYS_OTHER;
                      const days = Math.min(raw, cap);
                      if (raw > cap)
                        Alert.alert("Limited to max", `Capped at ${cap} days.`);

                      const hours = days * 24;
                      setExpiry({
                        key: "custom",
                        label: `${days} days`,
                        hours,
                      } as any);
                      setShowCustom(false);
                    }}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      backgroundColor: "#2563eb",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                    })}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      Set
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setShowCustom(false)}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                    })}
                  >
                    <Text style={{ fontWeight: "700" }}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Selected badge */}
            <View style={{ marginTop: 6 }}>
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: "#eef2ff",
                  borderColor: "#c7d2fe",
                  borderWidth: 1,
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: "#3730a3", fontWeight: "700" }}>
                  {expiryBadge(expiry)}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text>Enable call</Text>
              <Switch value={callEnabled} onValueChange={setCallEnabled} />
            </View>
          </View>

          <Pressable
            onPress={submit}
            disabled={!canPost}
            style={({ pressed }) => ({
              opacity: pressed || !canPost ? 0.6 : 1,
              backgroundColor: "#2563eb",
              padding: 14,
              borderRadius: 12,
              alignItems: "center",
              marginTop: 6,
              marginBottom: 12,
            })}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              {hasInFlight ? "Uploading…" : busy ? "Posting…" : "Post"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
