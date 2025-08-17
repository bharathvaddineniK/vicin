import HashtagField from "@/components/HashtagRow";
import LocationPicker, { Coords, LocationMode } from "@/components/LocationPicker";
import Screen from "@/components/Screen";
import { PerfMarker, useFps, useRenderCounter } from "@/hooks/perf";
import { getOneShot } from "@/lib/location";
import { uploadPostAssetWithProgress } from "@/lib/media";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useIsFocused } from "@react-navigation/native";
import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { nanoid } from "nanoid/non-secure";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/* ---------- Constants ---------- */
const TYPES = [
  { key: "update", label: "Update" },
  { key: "question", label: "Question" },
  { key: "help", label: "Help" },
  { key: "offer", label: "Offer" },
  { key: "event", label: "Event" },
] as const;

const EXPIRY_OPTIONS = [
  { key: "6h", label: "6 hrs", hours: 6 },
  { key: "12h", label: "12 hrs", hours: 12 },
  { key: "24h", label: "24 hrs", hours: 24 },
  { key: "48h", label: "48 hrs", hours: 48 },
  { key: "none", label: "No expiry", hours: null as number | null },
];

const DEFAULT_EXPIRY = { key: "48h", label: "48 hrs", hours: 48 } as const;

type ExpiryOption = {
  key: string;
  label: string;
  hours: number | null;
};
const MAX_DAYS_EVENT = 90;
const MAX_DAYS_OTHER = 30;
const MAX_CONTENT_LENGTH = 250;

/* ---------- Types ---------- */
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

/* ---------- Components ---------- */
const Shimmer = React.memo(({ style }: { style: any }) => {
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
    <Animated.View style={[{ backgroundColor: "#e5e7eb" }, style, { opacity }]} />
  );
});

const GuestModeGate = React.memo(() => (
  <Screen edges={["top"]}>
    <View style={styles.guestContainer}>
      <View style={styles.guestCard}>
        <Text style={styles.guestTitle}>Create an account to post</Text>
        <Text style={styles.guestSubtitle}>
          Posting, photos and video uploads require an account.
        </Text>

        <Pressable
          onPress={() => router.push("/(auth)/signup")}
          style={({ pressed }) => [
            styles.primaryButton,
            { opacity: pressed ? 0.7 : 1 }
          ]}
        >
          <Text style={styles.primaryButtonText}>Create account</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(auth)/login")}
          style={({ pressed }) => [
            styles.secondaryButton,
            { opacity: pressed ? 0.7 : 1 }
          ]}
        >
          <Text style={styles.secondaryButtonText}>Sign in</Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace("/(tabs)")}
          style={({ pressed }) => [
            styles.tertiaryButton,
            { opacity: pressed ? 0.6 : 1 }
          ]}
        >
          <Text style={styles.tertiaryButtonText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  </Screen>
));

/* ---------- Main Component ---------- */
export default function CreatePost() {
  // Performance monitoring
  if (__DEV__ && Platform.OS !== "android") {
    useFps("Post", 45);
    useRenderCounter("PostScreen");
  }

  const isFocused = useIsFocused();
  const { session, isGuest, loading } = useSession();
  const blocked = !loading && (isGuest || !session);

  // Form state
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<PostType>("update");
  const [expiry, setExpiry] = useState<ExpiryOption>(DEFAULT_EXPIRY);
  const [selectedKey, setSelectedKey] = useState<string>(DEFAULT_EXPIRY.key);
  const [callEnabled, setCallEnabled] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState<string[]>([])

  // Custom expiry state
  const [showCustom, setShowCustom] = useState(false);
  const [customDays, setCustomDays] = useState("");

  // Computed values
  const imgCount = useMemo(() => media.filter(m => m.kind === "image").length, [media]);
  const hasVideo = useMemo(() => media.some(m => m.kind === "video"), [media]);
  const hasInFlight = useMemo(() => media.some(m => m.status === "uploading"), [media]);
  const remaining = MAX_CONTENT_LENGTH - content.length;
  const canPost = !busy && !hasInFlight && content.trim().length >= 1 && content.trim().length <= MAX_CONTENT_LENGTH;


  const [locationMode, setLocationMode] = useState<LocationMode>("subject");
  const [venueLabel, setVenueLabel] = useState<string>("");
  const [venueCoords, setVenueCoords] = useState<Coords>(null);

  // Helper functions
  const getCoarseType = useCallback((type: PostType): "update" | "event" | "question" | "help" => {
    switch (type) {
      case "event": return "event";
      case "question": return "question";
      case "help": return "help";
      default: return "update";
    }
  }, []);

  const resetForm = useCallback(() => {
    setContent("");
    setMedia([]);
    setPostType("update");
    setCallEnabled(false);
    setExpiry(DEFAULT_EXPIRY);
    setSelectedKey(DEFAULT_EXPIRY.key);
    setCustomDays("");
    setShowCustom(false);
  }, []);

  // Media handlers
  const addImages = useCallback(async () => {
    if (imgCount >= 5) {
      return Alert.alert("Limit reached", "You can add up to 5 images.");
    }

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

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return Alert.alert("Sign in required", "Guests can't upload.");
    }

    const placeholders: UploadingItem[] = res.assets
      .slice(0, remainingSlots)
      .map(a => ({
        id: nanoid(),
        kind: "image",
        status: "uploading",
        localUri: a.uri,
      }));

    setMedia(prev => [...prev, ...placeholders]);

    // Upload images
    for (const ph of placeholders) {
      try {
        const result = await uploadPostAssetWithProgress(
          session.user.id,
          ph.localUri,
          Date.now(),
          () => { }
        );

        setMedia(prev =>
          prev.map(m =>
            m.id === ph.id
              ? { id: ph.id, kind: "image", status: "done", url: result.url }
              : m
          )
        );
      } catch (error) {
        setMedia(prev => prev.filter(m => m.id !== ph.id));
        Alert.alert("Upload failed", "One image could not be uploaded.");
      }
    }
  }, [imgCount]);

  const addVideo = useCallback(async () => {
    if (hasVideo) {
      return Alert.alert("Limit", "Only one video is allowed.");
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      quality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });

    if (res.canceled) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return Alert.alert("Sign in required", "Guests can't upload.");
    }

    const placeholder: UploadingItem = {
      id: nanoid(),
      kind: "video",
      status: "uploading",
      localUri: res.assets[0].uri,
    };

    setMedia(prev => [...prev, placeholder]);

    try {
      const result = await uploadPostAssetWithProgress(
        session.user.id,
        placeholder.localUri,
        Date.now(),
        () => { }
      );

      setMedia(prev =>
        prev.map(m =>
          m.id === placeholder.id
            ? { id: placeholder.id, kind: "video", status: "done", url: result.url }
            : m
        )
      );
    } catch (error) {
      setMedia(prev => prev.filter(m => m.id !== placeholder.id));
      Alert.alert("Upload failed", "The video could not be uploaded.");
    }
  }, [hasVideo]);

  const removeMedia = useCallback((id: string) => {
    setMedia(prev => prev.filter(m => m.id !== id));
  }, []);

  // Submit handler
  const submit = useCallback(async () => {
    if (!canPost) return;

    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return Alert.alert("Sign in required", "Guests can't post.");
      }

      const { latitude, longitude } = await getOneShot();
      const expires_at = expiry.hours
        ? new Date(Date.now() + expiry.hours * 3600_000).toISOString()
        : null;

      const fine = postType as PostType;
      const coarse = getCoarseType(fine);

      // Create post
      const { data: newId, error: rpcErr } = await supabase.rpc("create_post_geog", {
        _content: content.trim(),
        _post_type: fine,
        _type: coarse,
        _call_enabled: callEnabled,
        _expires_at: expires_at,
        _lat: latitude,
        _lng: longitude,
        _tags: tags, // text[] - e.g., ["weekend","meetup"]
        _location_source: locationMode,                  // 'subject' | 'venue'
        _venue_label: venueLabel?.trim() || null,
        _venue_lat: venueCoords?.lat ?? null,
        _venue_lng: venueCoords?.lng ?? null,
      });

      if (rpcErr) throw rpcErr;

      // Attach media
      const doneMedia = media.filter(m => m.status === "done") as DoneItem[];
      if (doneMedia.length) {
        const rows = doneMedia.map(m => ({
          post_id: newId as string,
          kind: m.kind,
          url: m.url,
        }));

        const { error: mErr } = await supabase.from("post_media").insert(rows);
        if (mErr) throw mErr;

        const { error: jErr } = await supabase
          .from("posts")
          .update({
            media: rows.map(r => ({ kind: r.kind, url: r.url })) as any,
          })
          .eq("id", newId as string);
        if (jErr) throw jErr;
      }

      resetForm();
      Alert.alert("Posted!", "Your post is live.");
    } catch (e: any) {
      Alert.alert("Couldn't post", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  }, [canPost, content, postType, expiry, callEnabled, media, getCoarseType, resetForm]);

  // Custom expiry handler
  const handleCustomExpiry = useCallback(() => {
    const raw = Number(customDays);
    if (!Number.isFinite(raw) || raw <= 0) {
      return Alert.alert("Invalid", "Enter a positive number of days.");
    }

    const cap = postType === "event" ? MAX_DAYS_EVENT : MAX_DAYS_OTHER;
    const days = Math.min(raw, cap);
    if (raw > cap) {
      Alert.alert("Limited to max", `Capped at ${cap} days.`);
    }

    const hours = days * 24;
    setExpiry({ key: "custom", label: `${days} days`, hours });
    setShowCustom(false);
  }, [customDays, postType]);

  // Render helpers
  const imageItems = useMemo(() => media.filter(m => m.kind === "image"), [media]);
  const videoItem = useMemo(() => media.find(m => m.kind === "video"), [media]);

  if (loading) {
    return <SafeAreaView style={styles.loadingContainer} />;
  }

  if (blocked) {
    return <GuestModeGate />;
  }

  const Content = (
    <Screen edges={["top"]}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 22, fontWeight: "800" }}>New post</Text>
            <LocationPicker
              mode={locationMode}
              venueLabel={venueLabel}
              venueCoords={venueCoords}
              onChange={(next) => {
                setLocationMode(next.mode);
                setVenueLabel(next.venueLabel);
                setVenueCoords(next.venueCoords);
              }}
              size="sm"
            />
          </View>

          {/* Post Type Selection */}
          <View style={styles.chipContainer}>
            {TYPES.map(t => (
              <Pressable
                key={t.key}
                onPress={() => setPostType(t.key)}
                style={({ pressed }) => [
                  styles.chip,
                  postType === t.key && styles.chipActive,
                  { opacity: pressed ? 0.7 : 1 }
                ]}
              >
                <Text style={[
                  styles.chipText,
                  postType === t.key && styles.chipTextActive
                ]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Content Input */}
          <View style={styles.inputContainer}>
            <TextInput
              placeholder="What's happening round you?"
              value={content}
              onChangeText={t => t.length <= MAX_CONTENT_LENGTH && setContent(t)}
              multiline
              textAlignVertical="top"
              style={styles.textInput}
            />
            <View style={styles.inputFooter}>
              <Text style={[
                styles.characterCount,
                remaining < 0 && styles.characterCountError
              ]}>
                {remaining} / {MAX_CONTENT_LENGTH}
              </Text>
              <Text style={styles.inputHint}>Keep it short & clear</Text>
            </View>
          </View>

          <HashtagField tags={tags} onChangeTags={setTags} />


          {/* Media Pickers */}
          <View style={styles.pickerContainer}>
            <Pressable
              onPress={addImages}
              disabled={imgCount >= 5}
              style={({ pressed }) => [
                styles.pickerButton,
                { opacity: pressed || imgCount >= 5 ? 0.6 : 1 }
              ]}
            >
              <Text style={styles.pickerButtonText}>
                Add images ({imgCount}/5)
              </Text>
            </Pressable>

            <Pressable
              onPress={addVideo}
              disabled={hasVideo}
              style={({ pressed }) => [
                styles.pickerButton,
                { opacity: pressed || hasVideo ? 0.6 : 1 }
              ]}
            >
              <Text style={styles.pickerButtonText}>
                {hasVideo ? "Video added" : "Add video (1)"}
              </Text>
            </Pressable>
          </View>

          {/* Images Display */}
          {imageItems.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaScroll}
            >
              {imageItems.map(item =>
                item.status === "uploading" ? (
                  <Shimmer key={item.id} style={styles.mediaPlaceholder} />
                ) : (
                  <View key={item.id} style={styles.mediaItem}>
                    <Image
                      source={{ uri: (item as DoneItem).url }}
                      style={styles.mediaImage}
                    />
                    <Pressable
                      onPress={() => removeMedia(item.id)}
                      hitSlop={10}
                      style={({ pressed }) => [
                        styles.removeButton,
                        { backgroundColor: pressed ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.35)" }
                      ]}
                    >
                      <Text style={styles.removeButtonText}>×</Text>
                    </Pressable>
                  </View>
                )
              )}
            </ScrollView>
          )}

          {/* Video Display */}
          {videoItem && (
            <View style={styles.videoContainer}>
              <Text style={styles.videoLabel}>Video</Text>
              {videoItem.status === "uploading" ? (
                <Shimmer style={styles.videoPlaceholder} />
              ) : (
                isFocused ? (
                  <Video
                    source={{ uri: (videoItem as DoneItem).url }}
                    useNativeControls
                    resizeMode={ResizeMode.COVER}
                    style={styles.video}
                  />
                ) : (
                  <View style={styles.videoPaused}>
                    <Text style={styles.videoPausedText}>Video paused</Text>
                  </View>
                )
              )}
              <Pressable onPress={() => removeMedia(videoItem.id)}>
                <Text style={styles.removeVideoText}>Remove video</Text>
              </Pressable>
            </View>
          )}

          {/* Visibility Settings */}
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsTitle}>Visibility</Text>

            <View style={styles.chipContainer}>
              {EXPIRY_OPTIONS.map(e => (
                <Pressable
                  key={e.key}
                  onPress={() => {
                    setSelectedKey(e.key);
                    setShowCustom(false);
                    setExpiry(e);
                  }}
                  style={({ pressed }) => [
                    styles.chip,
                    selectedKey === e.key && styles.chipActive,
                    { opacity: pressed ? 0.7 : 1 }
                  ]}
                >
                  <Text style={[
                    styles.chipText,
                    selectedKey === e.key && styles.chipTextActive
                  ]}>
                    {e.label}
                  </Text>
                </Pressable>
              ))}

              <Pressable
                onPress={() => {
                  setSelectedKey("custom");
                  setShowCustom(true);
                }}
                style={({ pressed }) => [
                  styles.chip,
                  selectedKey === "custom" && styles.chipActive,
                  { opacity: pressed ? 0.7 : 1 }
                ]}
              >
                <Text style={[
                  styles.chipText,
                  selectedKey === "custom" && styles.chipTextActive
                ]}>
                  Custom…
                </Text>
              </Pressable>
            </View>

            <Text style={styles.settingsHint}>
              {postType === "event" ? "Custom max: 90 days" : "Custom max: 30 days"}
            </Text>

            {/* Custom Expiry Panel */}
            {showCustom && (
              <View style={styles.customPanel}>
                <Text style={styles.customTitle}>Custom expiry</Text>
                <TextInput
                  placeholder="Days (e.g. 7)"
                  keyboardType="numeric"
                  value={customDays}
                  onChangeText={setCustomDays}
                  style={styles.customInput}
                />
                <View style={styles.customButtons}>
                  <Pressable
                    onPress={handleCustomExpiry}
                    style={({ pressed }) => [
                      styles.customSetButton,
                      { opacity: pressed ? 0.7 : 1 }
                    ]}
                  >
                    <Text style={styles.customSetButtonText}>Set</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowCustom(false)}
                    style={({ pressed }) => [
                      styles.customCancelButton,
                      { opacity: pressed ? 0.7 : 1 }
                    ]}
                  >
                    <Text style={styles.customCancelButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Selected Badge */}
            <View style={styles.badgeContainer}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {expiry.key === "none" ? "No expiry" : `Expires in ${expiry.label}`}
                </Text>
              </View>
            </View>

            {/* Call Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Enable call</Text>
              <Switch value={callEnabled} onValueChange={setCallEnabled} />
            </View>
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={submit}
            disabled={!canPost}
            style={({ pressed }) => [
              styles.submitButton,
              { opacity: pressed || !canPost ? 0.6 : 1 }
            ]}
          >
            <Text style={styles.submitButtonText}>
              {hasInFlight ? "Uploading…" : busy ? "Posting…" : "Post"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Screen>
  );

  return (
    <>
      {__DEV__ ? <PerfMarker label="PostScreen:render" /> : null}
      {Platform.OS === "android" ? (
        <SafeAreaView style={styles.androidContainer} edges={["top", "left", "right"]}>
          {Content}
        </SafeAreaView>
      ) : (
        Content
      )}
    </>
  );
}

/* ---------- Styles ---------- */
const styles = {
  // Layout
  loadingContainer: { flex: 1, backgroundColor: "#f8fafc" },
  androidContainer: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  // Guest mode
  guestContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center" as const,
    padding: 20,
  },
  guestCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  guestTitle: { fontSize: 18, fontWeight: "800" as const, textAlign: "center" as const },
  guestSubtitle: { color: "#6b7280", textAlign: "center" as const },

  // Typography
  title: { fontSize: 22, fontWeight: "800" as const },

  // Chips
  chipContainer: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  chipActive: { backgroundColor: "#2563eb" },
  chipText: { color: "#111827", fontWeight: "700" as const },
  chipTextActive: { color: "#fff" },

  // Input
  inputContainer: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  textInput: { minHeight: 120 },
  inputFooter: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginTop: 6,
  },
  characterCount: { color: "#64748b" },
  characterCountError: { color: "#ef4444" },
  inputHint: { color: "#94a3b8" },

  // Pickers
  pickerContainer: { flexDirection: "row" as const, gap: 8 },
  pickerButton: {
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  pickerButtonText: { fontWeight: "700" as const },

  // Media
  mediaScroll: { gap: 8 },
  mediaPlaceholder: { width: 96, height: 96, borderRadius: 12 },
  mediaItem: { position: "relative" as const },
  mediaImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  removeButton: {
    position: "absolute" as const,
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 12,
  },
  removeButtonText: { color: "#fff", fontWeight: "800" as const },

  // Video
  videoContainer: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  videoLabel: { fontWeight: "700" as const },
  videoPlaceholder: { width: "100%" as const, height: 180, borderRadius: 10 },
  video: { width: "100%" as const, height: 180, borderRadius: 10 },
  videoPaused: {
    width: "100%" as const,
    height: 180,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  videoPausedText: { color: "#64748b" },
  removeVideoText: { color: "#ef4444", fontWeight: "700" as const },

  // Settings
  settingsContainer: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  settingsTitle: { fontWeight: "800" as const },
  settingsHint: { color: "#94a3b8", marginTop: 4 },

  // Custom expiry
  customPanel: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
  },
  customTitle: { fontWeight: "800" as const, marginBottom: 6 },
  customInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
  },
  customButtons: { flexDirection: "row" as const, gap: 8, marginTop: 10 },
  customSetButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  customSetButtonText: { color: "#fff", fontWeight: "700" as const },
  customCancelButton: { paddingVertical: 10, paddingHorizontal: 12 },
  customCancelButtonText: { fontWeight: "700" as const },

  // Badge
  badgeContainer: { marginTop: 6 },
  badge: {
    alignSelf: "flex-start" as const,
    backgroundColor: "#eef2ff",
    borderColor: "#c7d2fe",
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeText: { color: "#3730a3", fontWeight: "700" as const },

  // Toggle
  toggleContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  toggleLabel: {},

  // Buttons
  primaryButton: {
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 12,
    alignItems: "center" as const,
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" as const },
  secondaryButton: {
    padding: 12,
    borderRadius: 12,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  secondaryButtonText: { fontWeight: "700" as const },
  tertiaryButton: { padding: 10, alignItems: "center" as const },
  tertiaryButtonText: { color: "#6b7280" },
  submitButton: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 12,
    alignItems: "center" as const,
    marginTop: 6,
    marginBottom: 12,
  },
  submitButtonText: { color: "#fff", fontWeight: "800" as const },
};
