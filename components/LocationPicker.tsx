import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    Modal,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";

export type LocationMode = "subject" | "venue";
export type Coords = { lat: number; lng: number } | null;

type Props = {
    mode: LocationMode;                      // committed value from parent
    venueLabel: string;                      // committed value from parent
    venueCoords: Coords;                     // committed value from parent
    onChange: (next: {
        mode: LocationMode;
        venueLabel: string;
        venueCoords: Coords;
    }) => void;
    size?: "sm" | "md";
};

/** Middle-ellipsis clipping for long labels (keeps start and end readable) */
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

    // DRAFT state only visible inside modal; chip displays *committed* props
    const [draftMode, setDraftMode] = useState<LocationMode>(mode);
    const [draftLabel, setDraftLabel] = useState<string>(venueLabel ?? "");
    const [draftCoords, setDraftCoords] = useState<Coords>(venueCoords ?? null);

    const log = (...args: any[]) => {
        if (__DEV__) console.log("[LocationPicker]", ...args);
    };

    const openSheet = useCallback(() => {
        // seed drafts from committed props
        setDraftMode(mode);
        setDraftLabel(venueLabel ?? "");
        setDraftCoords(venueCoords ?? null);
        setOpen(true);
    }, [mode, venueCoords, venueLabel]);

    const apply = useCallback(() => {
        // If user selected "venue" but provided neither label nor coords, fallback to subject
        const emptyVenue = draftMode === "venue" && !draftLabel.trim() && !draftCoords;
        const nextMode: LocationMode = emptyVenue ? "subject" : draftMode;

        onChange({
            mode: nextMode,
            venueLabel: nextMode === "venue" ? draftLabel.trim() : "",
            venueCoords: nextMode === "venue" ? draftCoords : null,
        });
        setOpen(false);
    }, [draftCoords, draftLabel, draftMode, onChange]);

    const clearVenue = useCallback(() => {
        setDraftMode("subject");
        setDraftLabel("");
        setDraftCoords(null);
    }, []);

    // IMPORTANT: chip text uses COMMITTED props, not drafts (no live changes while typing)
    const chipText = useMemo(() => {
        if (mode === "venue") {
            if (venueLabel?.length) return `📍 ${clipMiddle(venueLabel, 26)}`;
            if (venueCoords) {
                // Show coordinates with limited precision
                const lat = venueCoords.lat.toFixed(4);
                const lng = venueCoords.lng.toFixed(4);
                return `📍 ${lat}, ${lng}`;
            }
            return "📍 Venue";
        }
        return "📍 My location";
    }, [mode, venueCoords, venueLabel]);

    const openMap = useCallback(() => {
        log("Opening map picker screen...");
        // Store current coordinates for the map to use as initial position
        if (draftCoords) {
            (global as any).initialLocationCoords = draftCoords;
        }
        // Close the modal first, then navigate to the map picker screen
        setOpen(false);
        router.push("/location/post-picker");
    }, [draftCoords]);

    // Check for returned coordinates when screen comes back into focus
    useFocusEffect(
        useCallback(() => {
            // Check if coordinates were selected from the map picker
            const selectedCoords = (global as any).selectedLocationCoords;
            const selectedLabel = (global as any).selectedLocationLabel;
            if (selectedCoords) {
                log("Received coordinates from map picker:", selectedCoords);
                log("Received location label:", selectedLabel);
                
                // Directly apply the coordinates and label without reopening modal
                onChange({
                    mode: "venue",
                    venueLabel: selectedLabel || "",
                    venueCoords: selectedCoords,
                });
                
                // Clear the global variables
                delete (global as any).selectedLocationCoords;
                delete (global as any).selectedLocationLabel;
                
                log("Applied coordinates and label directly to parent component");
            }
        }, [onChange])
    );

    return (
        <>
            {/* Chip — place outside the description card, top-right of the section header */}
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

            {/* Settings modal */}
            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }}>
                    <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" }}>
                        <Text style={{ fontSize: 18, fontWeight: "800", textAlign: "center" }}>Post location</Text>

                        {/* Mode selectors */}
                        <View style={{ marginTop: 14, gap: 8 }}>
                            <Pressable
                                onPress={() => setDraftMode("subject")}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: draftMode === "subject" }}
                                style={({ pressed }) => ({
                                    padding: 10, borderRadius: 10, borderWidth: 1,
                                    borderColor: draftMode === "subject" ? "#60a5fa" : "#e5e7eb",
                                    backgroundColor: pressed ? "#f8fafc" : "#fff",
                                })}
                            >
                                <Text style={{ fontWeight: "700" }}>Use my current location</Text>
                                <Text style={{ color: "#6b7280", marginTop: 2 }}>Good for updates near you.</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => setDraftMode("venue")}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: draftMode === "venue" }}
                                style={({ pressed }) => ({
                                    padding: 10, borderRadius: 10, borderWidth: 1,
                                    borderColor: draftMode === "venue" ? "#60a5fa" : "#e5e7eb",
                                    backgroundColor: pressed ? "#f8fafc" : "#fff",
                                })}
                            >
                                <Text style={{ fontWeight: "700" }}>Set a venue</Text>
                                <Text style={{ color: "#6b7280", marginTop: 2 }}>For events happening elsewhere.</Text>
                            </Pressable>
                        </View>

                        {/* Venue inputs (draft only; no effect on chip until Apply) */}
                        {draftMode === "venue" && (
                            <View style={{ marginTop: 12, gap: 10 }}>
                                <View>
                                    <Text style={{ fontWeight: "700", marginBottom: 6 }}>Venue label (optional)</Text>
                                    <TextInput
                                        value={draftLabel}
                                        onChangeText={setDraftLabel}
                                        placeholder="e.g. Central Park, Pier 39"
                                        placeholderTextColor="#9ca3af"
                                        autoCapitalize="words"
                                        style={{
                                            borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10,
                                            paddingHorizontal: 10, paddingVertical: 10, backgroundColor: "#f8fafc",
                                        }}
                                    />
                                </View>

                                <Pressable
                                    onPress={openMap}
                                    style={({ pressed }) => ({
                                        opacity: pressed ? 0.7 : 1,
                                        paddingVertical: 12, borderRadius: 10, alignItems: "center",
                                        borderWidth: 1, borderColor: "#93c5fd", backgroundColor: "#fff",
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
                                            paddingVertical: 8, paddingHorizontal: 10,
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
                            <Pressable onPress={() => setOpen(false)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingVertical: 10, paddingHorizontal: 12 })}>
                                <Text style={{ fontWeight: "700" }}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={apply}
                                style={({ pressed }) => ({
                                    opacity: pressed ? 0.7 : 1,
                                    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#2563eb",
                                })}
                                accessibilityLabel="Apply location"
                            >
                                <Text style={{ color: "#fff", fontWeight: "800" }}>Apply</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>



        </>
    );
}
