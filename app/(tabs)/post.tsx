import HashtagField from "@/components/HashtagRow";
import LocationPicker, { Coords, LocationMode } from "@/components/LocationPicker";
import MediaUploader, { MediaItem } from "@/components/MediaUploader";
import Screen from "@/components/Screen";
import { PerfMarker, useFps, useRenderCounter } from "@/hooks/perf";
import { useDraftProtection } from "@/hooks/useDraftProtection";
import { deleteDraft, DraftData, saveDraft } from "@/lib/drafts";
import { getOneShot } from "@/lib/location";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View
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

/* ---------- Components ---------- */
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
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState<string[]>([]);

  // Media state - managed by MediaUploader
  const [hasInFlight, setHasInFlight] = useState(false);
  const [readyMedia, setReadyMedia] = useState<MediaItem[]>([]);
  const [mediaResetTrigger, setMediaResetTrigger] = useState(0);

  // Custom expiry state
  const [showCustom, setShowCustom] = useState(false);
  const [customDays, setCustomDays] = useState("");

  // Location state
  const [locationMode, setLocationMode] = useState<LocationMode>("subject");
  const [venueLabel, setVenueLabel] = useState<string>("");
  const [venueCoords, setVenueCoords] = useState<Coords>(null);

  // Draft state
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Computed values
  const remaining = MAX_CONTENT_LENGTH - content.length;
  const canPost = !busy && !hasInFlight && content.trim().length >= 1 && content.trim().length <= MAX_CONTENT_LENGTH;

  // Check if there are unsaved changes - more sensitive detection
  const hasUnsavedChanges = useMemo(() => {
    // Check each field individually for any changes from default state
    const hasContent = content.trim().length > 0;
    const hasPostTypeChange = postType !== "update";
    const hasTags = tags.length > 0;
    const hasLocationChange = locationMode !== "subject";
    const hasVenueLabel = venueLabel.trim().length > 0;
    const hasVenueCoords = venueCoords !== null;
    const hasCallEnabled = callEnabled !== false;
    const hasExpiryChange = expiry.key !== DEFAULT_EXPIRY.key;
    const hasCustomDays = customDays.length > 0;
    const hasMediaChanges = readyMedia.length > 0;
    const hasMediaInFlight = hasInFlight; // Include in-flight media uploads

    // Log for debugging (remove in production)
    if (__DEV__) {
      const changes = {
        hasContent,
        hasPostTypeChange,
        hasTags,
        hasLocationChange,
        hasVenueLabel,
        hasVenueCoords,
        hasCallEnabled,
        hasExpiryChange,
        hasCustomDays,
        hasMediaChanges,
        hasMediaInFlight,
      };
      const hasAnyChanges = Object.values(changes).some(Boolean);
      if (hasAnyChanges) {
        console.log('Draft changes detected:', changes);
      }
    }

    return (
      hasContent ||
      hasPostTypeChange ||
      hasTags ||
      hasLocationChange ||
      hasVenueLabel ||
      hasVenueCoords ||
      hasCallEnabled ||
      hasExpiryChange ||
      hasCustomDays ||
      hasMediaChanges ||
      hasMediaInFlight
    );
  }, [content, postType, tags, locationMode, venueLabel, venueCoords, callEnabled, expiry, customDays, readyMedia, hasInFlight]);

  // Draft data for saving
  const draftData: DraftData = useMemo(() => ({
    content: content.trim(),
    post_type: postType,
    tags,
    location_mode: locationMode,
    venue_label: venueLabel.trim(),
    venue_coords: venueCoords,
    call_enabled: callEnabled,
    expiry_hours: expiry.hours,
    custom_days: customDays,
  }), [content, postType, tags, locationMode, venueLabel, venueCoords, callEnabled, expiry, customDays]);

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
    setPostType("update");
    setCallEnabled(false);
    setExpiry(DEFAULT_EXPIRY);
    setSelectedKey(DEFAULT_EXPIRY.key);
    setCustomDays("");
    setShowCustom(false);
    setTags([]);
    // Reset location
    setLocationMode("subject");
    setVenueLabel("");
    setVenueCoords(null);
    // Reset media by incrementing the trigger
    setMediaResetTrigger(prev => prev + 1);
  }, []);

  // Mark draft as loaded without auto-loading or deleting (drafts should only load when explicitly opened from profile)
  useEffect(() => {
    if (session && !draftLoaded) {
      setDraftLoaded(true);
    }
  }, [session, draftLoaded]);

  // Draft protection handlers
  const handleSaveDraft = useCallback(async (data: DraftData) => {
    try {
      console.log('Attempting to save draft:', data);
      const draftId = await saveDraft(data);
      console.log('Draft saved successfully with ID:', draftId);
    } catch (error) {
      console.error('Error saving draft:', error);
      throw error; // Re-throw so the error handling in useDraftProtection works
    }
  }, []);

  const handleDiscardDraft = useCallback(() => {
    resetForm();
    // Only clear the form - don't delete existing drafts from database
    // Drafts should only be deleted when explicitly managed or after successful post
  }, [resetForm]);

  // Use draft protection hook
  const { checkBeforeNavigation } = useDraftProtection({
    hasUnsavedChanges,
    draftData,
    onSaveDraft: handleSaveDraft,
    onDiscardDraft: handleDiscardDraft,
  });

  // Register draft protection with global system
  useEffect(() => {
    if (isFocused) {
      // Register when post screen is focused
      (global as any).setDraftProtection?.(checkBeforeNavigation);
    } else {
      // Unregister when post screen loses focus
      (global as any).setDraftProtection?.(null);
    }

    return () => {
      // Cleanup on unmount
      (global as any).setDraftProtection?.(null);
    };
  }, [isFocused, checkBeforeNavigation]);

  // Media handlers
  const handleMediaStateChange = useCallback((inFlight: boolean) => {
    setHasInFlight(inFlight);
  }, []);

  const handleMediaReady = useCallback((items: MediaItem[]) => {
    setReadyMedia(items);
  }, []);

  const handleMediaError = useCallback((error: string) => {
    console.error('Media upload error:', error);
    // Error is already shown by MediaUploader component
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
        _tags: tags,
        _location_source: locationMode,
        _venue_label: venueLabel?.trim() || null,
        _venue_lat: venueCoords?.lat ?? null,
        _venue_lng: venueCoords?.lng ?? null,
      });

      if (rpcErr) throw rpcErr;

      // Attach media
      if (readyMedia.length > 0) {
        const rows = readyMedia.map(m => ({
          post_id: newId as string,
          kind: m.kind,
          url: m.url!,
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
      // Delete draft after successful post
      deleteDraft().catch(error => console.error('Failed to delete draft:', error));
      Alert.alert("Posted!", "Your post is live.");
    } catch (e: any) {
      Alert.alert("Couldn't post", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  }, [canPost, content, postType, expiry, callEnabled, tags, locationMode, venueLabel, venueCoords, readyMedia, getCoarseType, resetForm]);

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

  if (loading) {
    return <SafeAreaView style={styles.loadingContainer} />;
  }

  if (blocked) {
    return <GuestModeGate />;
  }

  const Content = (
    <Screen edges={["top"]}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
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
              returnKeyType="done"
              blurOnSubmit={true}
              onSubmitEditing={() => {
                Keyboard.dismiss();
              }}
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

          {/* Media Uploader Component */}
          {session && (
            <MediaUploader
              userId={session.user.id}
              maxImages={5}
              maxVideos={1}
              onMediaStateChange={handleMediaStateChange}
              onMediaReady={handleMediaReady}
              onError={handleMediaError}
              disabled={busy}
              resetTrigger={mediaResetTrigger}
            />
          )}

          {/* Visibility Settings */}
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsTitle}>Visibility</Text>

            {/* Expiry Options Pills with Scroll Indicator */}
            <View style={styles.expiryContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.expiryScrollContainer}
              >
                {EXPIRY_OPTIONS.map(e => (
                  <Pressable
                    key={e.key}
                    onPress={() => {
                      setSelectedKey(e.key);
                      setShowCustom(false);
                      setExpiry(e);
                    }}
                    style={({ pressed }) => [
                      styles.expiryPill,
                      selectedKey === e.key && styles.expiryPillActive,
                      { opacity: pressed ? 0.8 : 1 }
                    ]}
                  >
                    <Text style={[
                      styles.expiryPillText,
                      selectedKey === e.key && styles.expiryPillTextActive
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
                    styles.expiryPill,
                    selectedKey === "custom" && styles.expiryPillActive,
                    { opacity: pressed ? 0.8 : 1 }
                  ]}
                >
                  <Text style={[
                    styles.expiryPillText,
                    selectedKey === "custom" && styles.expiryPillTextActive
                  ]}>
                    Custom
                  </Text>
                </Pressable>
              </ScrollView>
              
              {/* Scroll Indicator */}
              <View style={styles.scrollIndicator}>
                <Text style={styles.scrollHint}>← Swipe for more options</Text>
              </View>
            </View>

            {/* Custom Expiry Panel with Keyboard Handling */}
            {showCustom && (
              <View style={styles.customPanel}>
                <View style={styles.customHeader}>
                  <Text style={styles.customTitle}>Custom Duration</Text>
                  <Text style={styles.customSubtitle}>
                    {postType === "event" ? "Maximum 90 days" : "Maximum 30 days"}
                  </Text>
                </View>
                <View style={styles.customInputContainer}>
                  <TextInput
                    placeholder="Enter days"
                    keyboardType="numeric"
                    value={customDays}
                    onChangeText={setCustomDays}
                    style={styles.customInput}
                    autoFocus={true}
                    returnKeyType="done"
                    blurOnSubmit={true}
                    onSubmitEditing={() => {
                      handleCustomExpiry();
                      Keyboard.dismiss();
                    }}
                  />
                  <View style={styles.customActions}>
                    <Pressable
                      onPress={() => setShowCustom(false)}
                      style={({ pressed }) => [
                        styles.customCancelButton,
                        { opacity: pressed ? 0.7 : 1 }
                      ]}
                    >
                      <Text style={styles.customCancelButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleCustomExpiry}
                      style={({ pressed }) => [
                        styles.customSetButton,
                        { opacity: pressed ? 0.7 : 1 }
                      ]}
                    >
                      <Text style={styles.customSetButtonText}>Apply</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* Current Selection Display */}
            <View style={styles.currentSelection}>
              <View style={styles.selectionIcon}>
                <Text style={styles.selectionIconText}>⏱</Text>
              </View>
              <Text style={styles.selectionText}>
                {expiry.key === "none" ? "Never expires" : `Expires in ${expiry.label}`}
              </Text>
            </View>

            {/* Call Toggle */}
            <View style={styles.toggleContainer}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Enable voice calls</Text>
                <Text style={styles.toggleDescription}>Allow others to call you about this post</Text>
              </View>
              <Switch 
                value={callEnabled} 
                onValueChange={setCallEnabled}
                trackColor={{ false: '#e5e7eb', true: '#3b82f6' }}
                thumbColor={callEnabled ? '#ffffff' : '#f3f4f6'}
              />
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
      </KeyboardAvoidingView>
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

  // Settings
  settingsContainer: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 16,
  },
  settingsTitle: { 
    fontWeight: "800" as const, 
    fontSize: 16,
    color: "#111827",
    marginBottom: 4,
  },

  // Modern Expiry Pills with Scroll Indicator
  expiryContainer: {
    position: "relative" as const,
  },
  expiryScrollContainer: {
    flexDirection: "row" as const,
    gap: 10,
    paddingHorizontal: 2,
  },
  expiryPill: {
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  expiryPillActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  expiryPillText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#64748b",
    textAlign: "center" as const,
  },
  expiryPillTextActive: {
    color: "#ffffff",
    fontWeight: "700" as const,
  },
  scrollIndicator: {
    alignItems: "center" as const,
    marginTop: 8,
  },
  scrollHint: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic" as const,
  },

  // Enhanced Custom Panel
  customPanel: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginTop: 8,
  },
  customHeader: {
    marginBottom: 12,
  },
  customTitle: { 
    fontWeight: "700" as const, 
    fontSize: 15,
    color: "#111827",
    marginBottom: 2,
  },
  customSubtitle: {
    fontSize: 13,
    color: "#6b7280",
  },
  customInputContainer: {
    gap: 12,
  },
  customInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  customActions: { 
    flexDirection: "row" as const, 
    gap: 10,
    justifyContent: "flex-end" as const,
  },
  customSetButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  customSetButtonText: { 
    color: "#fff", 
    fontWeight: "600" as const,
    fontSize: 14,
  },
  customCancelButton: { 
    paddingVertical: 10, 
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  customCancelButtonText: { 
    fontWeight: "600" as const,
    color: "#6b7280",
    fontSize: 14,
  },

  // Current Selection Display
  currentSelection: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  selectionIcon: {
    width: 28,
    height: 28,
    backgroundColor: "#e0e7ff",
    borderRadius: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  selectionIconText: {
    fontSize: 14,
  },
  selectionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#374151",
  },

  // Enhanced Toggle
  toggleContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingTop: 4,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#111827",
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },

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
