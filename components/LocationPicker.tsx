// components/LocationPicker.tsx
import useGeocodeSearch, { GeocodeResult } from "@/hooks/useGeocodeSearch";
import { router, useFocusEffect } from "expo-router";
import { nanoid } from "nanoid/non-secure";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  View
} from "react-native";

export type LocationMode = "subject" | "venue";
export type Coords = { lat: number; lng: number } | null;

type Props = {
  mode: LocationMode;
  venueLabel: string;
  venueCoords: Coords;
  onChange: (next: { mode: LocationMode; venueLabel: string; venueCoords: Coords }) => void;
  size?: "sm" | "md";
};

function clipMiddle(s: string, max = 24) {
  if (!s) return s;
  if (s.length <= max) return s;
  const keep = Math.max(3, Math.floor((max - 1) / 2));
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

export default function LocationPicker({
  mode,
  venueLabel,
  venueCoords,
  onChange,
  size = "sm",
}: Props) {
  const [open, setOpen] = useState(false);

  // DRAFT (modal-only)
  const [draftMode, setDraftMode] = useState<LocationMode>(mode);
  const [draftLabel, setDraftLabel] = useState<string>(venueLabel ?? "");
  const [draftCoords, setDraftCoords] = useState<Coords>(venueCoords ?? null);

  // dropdown anchoring
  const cardRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);
  const selectingRef = useRef(false);
  const [dropdownTop, setDropdownTop] = useState(0);
  const [dropdownWidth, setDropdownWidth] = useState<number | "100%">("100%");
  const [inputFocused, setInputFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // geocode hook
  const {
    setQuery,
    results,
    loading,
    error,
    search,
    clear,
    resolvePlace,
    setSessionToken,
  } = useGeocodeSearch({ minChars: 3, limit: 6 });

  const log = (...args: any[]) => {
    if (__DEV__) console.log("[LP]", ...args);
  };

  const chipText = useMemo(() => {
    if (mode === "venue") {
      if (venueLabel?.length) return `📍 ${clipMiddle(venueLabel, 26)}`;
      if (venueCoords) {
        const lat = venueCoords.lat.toFixed(4);
        const lng = venueCoords.lng.toFixed(4);
        return `📍 ${lat}, ${lng}`;
      }
      return "📍 Venue";
    }
    return "📍 My location";
  }, [mode, venueLabel, venueCoords]);

  const openSheet = useCallback(() => {
    // seed drafts
    setDraftMode(mode);
    setDraftLabel(venueLabel ?? "");
    setDraftCoords(venueCoords ?? null);
    setInputFocused(false);
    setShowDropdown(false);
    selectingRef.current = false;
    clear();

    // create a Places session token for this modal session
    setSessionToken(nanoid());

    setOpen(true);
  }, [mode, venueCoords, venueLabel, clear, setSessionToken]);

  const measureDropdown = useCallback(() => {
    const inputNode = findNodeHandle(inputRef.current);
    const cardNode = findNodeHandle(cardRef.current);
    if (!inputNode || !cardNode) return;
    UIManager.measureLayout(
      inputNode,
      cardNode,
      () => { },
      (x, y, w, h) => {
        setDropdownTop(y + h + 8);
        setDropdownWidth(w || "100%");
        log("measureDropdown()", { x, y, w, h, dropdownTop: y + h + 8 });
      }
    );
  }, []);

  const onInputLayout = useCallback(
    (_e: LayoutChangeEvent) => {
      measureDropdown();
    },
    [measureDropdown]
  );

  const onInputFocus = useCallback(() => {
    log("onInputFocus()");
    setInputFocused(true);
    measureDropdown();
    const q = draftLabel.trim();
    if (q.length >= 3) {
      log("focus triggers search()", q);
      setQuery(q);
      search();
      setShowDropdown(true);
    }
  }, [draftLabel, measureDropdown, search, setQuery]);

  // IMPORTANT FIX:
  // Do NOT auto-hide the dropdown on blur while it's visible — let the tap land first.
  // We hide it on selection or when changing mode / cancel / apply.
  const onInputBlur = useCallback(() => {
    if (showDropdown || selectingRef.current) {
      log("onInputBlur() suppressed (dropdown open or selecting)");
      return;
    }
    log("onInputBlur() -> hide (no dropdown)");
    setInputFocused(false);
    setShowDropdown(false);
  }, [showDropdown]);

  const onChangeVenueInput = useCallback(
    (t: string) => {
      setDraftLabel(t);
      const q = t.trim();
      log("onChangeVenueInput()", { t, q, inputFocused });
      if (inputFocused && q.length >= 3) {
        setQuery(q);
        search();
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
    },
    [inputFocused, search, setQuery]
  );

  const selectResult = useCallback(
    async (r: GeocodeResult) => {
      log("selectResult()", r);
      selectingRef.current = true;

      let nextLabel = r?.label ?? "";
      let nextCoords: Coords =
        r?.coords && typeof r.coords.lat === "number" && typeof r.coords.lng === "number"
          ? { lat: r.coords.lat, lng: r.coords.lng }
          : null;

      // If the item has no coords (e.g., Google autocomplete), resolve details now.
      if (!nextCoords && r?.id) {
        try {
          const det = await resolvePlace(r.id);
          if (det) {
            nextLabel = det.label || nextLabel;
            if (det.coords && typeof det.coords.lat === "number" && typeof det.coords.lng === "number") {
              nextCoords = { lat: det.coords.lat, lng: det.coords.lng };
            }
          }
        } catch (e: any) {
          log("resolvePlace error", e?.message ?? e);
        }
      }

      // Apply to draft immediately
      setDraftMode("venue");
      setDraftLabel(nextLabel);
      setDraftCoords(nextCoords);
      setQuery(nextLabel);

      // Hide dropdown and keyboard
      setShowDropdown(false);
      setInputFocused(false);

      // Defer blur to next tick so press completes first on all platforms
      setTimeout(() => {
        inputRef.current?.blur();
        Keyboard.dismiss();
        selectingRef.current = false;
      }, 0);
    },
    [resolvePlace, setQuery]
  );

  const openMap = useCallback(() => {
    log("openMap()", draftCoords);
    if (draftCoords) (global as any).initialLocationCoords = draftCoords;
    setOpen(false);
    router.push("/location/post-picker");
  }, [draftCoords]);

  const apply = useCallback(() => {
    const labelTrim = draftLabel.trim();
    const hasLabel = labelTrim.length > 0;
    const hasCoords = !!draftCoords;
    const nextMode: LocationMode = hasLabel || hasCoords ? "venue" : "subject";
    log("apply()", { labelTrim, hasLabel, hasCoords, nextMode, draftCoords });
    onChange({
      mode: nextMode,
      venueLabel: nextMode === "venue" ? labelTrim : "",
      venueCoords: nextMode === "venue" ? draftCoords : null,
    });
    setShowDropdown(false);
    setOpen(false);
  }, [draftLabel, draftCoords, onChange]);

  const clearVenue = useCallback(() => {
    log("clearVenue()");
    setDraftMode("subject");
    setDraftLabel("");
    setDraftCoords(null);
    setShowDropdown(false);
    selectingRef.current = false;
    clear();
  }, [clear]);

  useEffect(() => {
    log("results changed", { count: results?.length ?? 0, loading, error, showDropdown });
  }, [results, loading, error, showDropdown]);

  // return-from-map handling (commit immediately)
  useFocusEffect(
    useCallback(() => {
      const selectedCoords = (global as any).selectedLocationCoords;
      const selectedLabel = (global as any).selectedLocationLabel;
      if (selectedCoords) {
        log("useFocusEffect -> returned from map", { selectedCoords, selectedLabel });
        setDraftMode("venue");
        setDraftCoords(selectedCoords);
        if (selectedLabel) {
          setDraftLabel(selectedLabel);
          setQuery(selectedLabel);
        }
        onChange({
          mode: "venue",
          venueLabel: selectedLabel || "",
          venueCoords: selectedCoords,
        });
        delete (global as any).selectedLocationCoords;
        delete (global as any).selectedLocationLabel;
      }
    }, [onChange, setQuery])
  );

  return (
    <>
      {/* Chip */}
      <Pressable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel="Choose post location"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: size === "sm" ? 6 : 8,
          paddingHorizontal: size === "sm" ? 10 : 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: "#cbd5e1",
          backgroundColor: pressed ? "#f1f5f9" : "#fff",
          shadowColor: "#000",
          shadowOpacity: Platform.OS === "ios" ? 0.08 : 0,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        })}
      >
        <Text style={{ fontWeight: "700", color: "#111827" }}>{chipText}</Text>
      </Pressable>

      {/* Modal (fixed height); dropdown overlays inside with your styling */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.select({ ios: "padding", android: undefined })}
            style={{ flex: 1, justifyContent: "center" }}
          >
            <View
              ref={cardRef}
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                maxHeight: "90%",
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "800", textAlign: "center" }}>
                Post location
              </Text>

              {/* Mode selectors */}
              <View style={{ marginTop: 14, gap: 8 }}>
                <Pressable
                  onPress={() => {
                    log("select mode: subject");
                    setDraftMode("subject");
                    setShowDropdown(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: draftMode === "subject" }}
                  style={({ pressed }) => ({
                    padding: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: draftMode === "subject" ? "#60a5fa" : "#e5e7eb",
                    backgroundColor: pressed ? "#f8fafc" : "#fff",
                  })}
                >
                  <Text style={{ fontWeight: "700" }}>Use my current location</Text>
                  <Text style={{ color: "#6b7280", marginTop: 2 }}>Good for updates near you.</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    log("select mode: venue");
                    setDraftMode("venue");
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: draftMode === "venue" }}
                  style={({ pressed }) => ({
                    padding: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: draftMode === "venue" ? "#60a5fa" : "#e5e7eb",
                    backgroundColor: pressed ? "#f8fafc" : "#fff",
                  })}
                >
                  <Text style={{ fontWeight: "700" }}>Set a venue</Text>
                  <Text style={{ color: "#6b7280", marginTop: 2 }}>
                    For events happening elsewhere.
                  </Text>
                </Pressable>
              </View>

              {/* Venue input + anchored dropdown (STYLING UNCHANGED) */}
              {draftMode === "venue" && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontWeight: "700", marginBottom: 6 }}>Search or name the venue</Text>

                  <View style={{ position: "relative" }}>
                    <TextInput
                      ref={inputRef}
                      value={draftLabel}
                      onChangeText={onChangeVenueInput}
                      placeholder="e.g. 180 Elm St, Weekend Meetup @ Central Park"
                      placeholderTextColor="#9ca3af"
                      autoCapitalize="words"
                      autoCorrect
                      onFocus={onInputFocus}
                      onBlur={onInputBlur}
                      onLayout={onInputLayout}
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                      style={{
                        borderWidth: 1,
                        borderColor: "#e6e9ef",
                        borderRadius: 10,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        backgroundColor: "#fff",
                        height: 44,
                      }}
                    />

                    {showDropdown && (
                      <View
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 52, // input(44) + gap(8)
                          right: 0,
                          zIndex: 50,
                          elevation: 8,
                          backgroundColor: "#fff",
                          borderRadius: 12,
                          maxHeight: 280,
                          borderWidth: 1,
                          borderColor: "#e6e9ef",
                          shadowColor: "#000",
                          shadowOpacity: 0.08,
                          shadowRadius: 12,
                          shadowOffset: { width: 0, height: 6 },
                        }}
                        collapsable={false}
                        // Make the container itself "interactive" so touches set the guard
                        onStartShouldSetResponder={() => {
                          selectingRef.current = true;
                          return true;
                        }}
                        onResponderGrant={() => {
                          selectingRef.current = true;
                        }}
                        onResponderRelease={() => {
                          // release after press handlers run
                          setTimeout(() => (selectingRef.current = false), 0);
                        }}
                        pointerEvents="auto"
                      >
                        {loading && (
                          <View
                            style={{
                              paddingVertical: 14,
                              paddingHorizontal: 12,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <ActivityIndicator />
                          </View>
                        )}

                        {!loading && !!error && (
                          <View style={{ paddingVertical: 12, paddingHorizontal: 12 }}>
                            <Text style={{ color: "#ef4444" }}>{String(error)}</Text>
                          </View>
                        )}

                        {!loading && !error && (results?.length ?? 0) === 0 && (
                          <View style={{ paddingVertical: 12, paddingHorizontal: 12 }}>
                            <Text style={{ color: "#6b7280" }}>No matches</Text>
                          </View>
                        )}

                        {!loading && !error && (results?.length ?? 0) > 0 && (
                          <ScrollView
                            keyboardShouldPersistTaps="always"
                            contentContainerStyle={{ paddingVertical: 4 }}
                            // extra safety: any touch inside dropdown marks selecting
                            onStartShouldSetResponderCapture={() => {
                              selectingRef.current = true;
                              return false; // let children (items) handle the press
                            }}
                            onTouchStart={() => {
                              selectingRef.current = true;
                            }}
                            onTouchEnd={() => {
                              // let onPress finish first
                              setTimeout(() => (selectingRef.current = false), 0);
                            }}
                          >
                            {results!.map((r: GeocodeResult, idx: number): React.ReactNode => {
                              const handlePress = async () => {
                                selectingRef.current = true;
                                await selectResult(r);
                                setShowDropdown(false)
                                setTimeout(() => (selectingRef.current = false), 0);
                              };
                              return (
                                <Pressable
                                  key={`${r.id ?? r.label}-${r.coords?.lat}-${r.coords?.lng}-${idx}`}
                                  onPressIn={() => {
                                    selectingRef.current = true;
                                  }}
                                  onPress={handlePress}
                                  onPressOut={() => {
                                    selectingRef.current = false;
                                  }}
                                  style={({ pressed }) => ({
                                    paddingVertical: 16,
                                    paddingHorizontal: 14,
                                    borderBottomWidth: idx < (results!.length - 1) ? 1 : 0,
                                    borderBottomColor: "#f1f5f9",
                                    backgroundColor: pressed ? "#f8fafc" : "#fff",
                                  })}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Text style={{ fontWeight: "700", color: "#0f172a" }}>{r.label}</Text>
                                  {!!r.subtitle && (
                                    <Text style={{ color: "#64748b", marginTop: 2 }}>{r.subtitle}</Text>
                                  )}
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        )}
                      </View>
                    )}
                  </View>

                  <View style={{ height: 10 }} />

                  <Pressable
                    onPress={openMap}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "#93c5fd",
                      backgroundColor: "#fff",
                    })}
                    accessibilityLabel="Choose location on map"
                  >
                    <Text style={{ fontWeight: "700" }}>
                      {draftCoords ? "Change on map" : "Choose on map"}
                    </Text>
                  </Pressable>

                  {!!(draftLabel || draftCoords) && (
                    <Pressable
                      onPress={clearVenue}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.7 : 1,
                        alignSelf: "flex-start",
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                      })}
                      accessibilityLabel="Clear venue"
                    >
                      <Text style={{ color: "#ef4444", fontWeight: "700" }}>Clear venue</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Actions */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
                <Pressable
                  onPress={() => {
                    setShowDropdown(false);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                  })}
                >
                  <Text style={{ fontWeight: "700" }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={apply}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    backgroundColor: "#2563eb",
                  })}
                  accessibilityLabel="Apply location"
                >
                  <Text style={{ color: "#fff", fontWeight: "800" }}>Apply</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}
