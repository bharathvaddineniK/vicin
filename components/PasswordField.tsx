import { assessPassword } from "@/lib/passwordStrength";
import { theme } from "@/lib/theme";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

export default function PasswordField({
  value,
  onChangeText,
  placeholder = "Password",
  showStrength = false,
  testID,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  showStrength?: boolean;
  testID?: string;
}) {
  const [show, setShow] = useState(false);
  const canToggle = value.length > 0;
  const strength = useMemo(() => assessPassword(value), [value]);
  const lastSpokenScore = useRef<number | null>(null);

  // Announce strength changes politely (no spam)
  useEffect(() => {
    if (!showStrength || value.length === 0) return;
    if (lastSpokenScore.current === strength.score) return;
    lastSpokenScore.current = strength.score;
    const msg = `Password strength: ${strength.label}`;
    AccessibilityInfo.announceForAccessibility?.(msg);
  }, [showStrength, value.length, strength.label, strength.score]);

  return (
    <View style={{ gap: theme.space.xs }}>
      <View style={{ position: "relative" }}>
        <TextInput
          testID={testID}
          placeholder={placeholder}
          placeholderTextColor="#6B7280"
          secureTextEntry={!show}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          // Suppress iOS strong-password sheet that caused glitches
          textContentType={Platform.OS === "ios" ? "oneTimeCode" : "password"}
          autoComplete="off"
          accessibilityLabel={placeholder}
          accessible
          style={{
            backgroundColor: "#FFF",
            color: theme.colors.text,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
            padding: 12,
            paddingRight: 64,
            minHeight: theme.touch,
          }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={show ? "Hide password" : "Show password"}
          accessibilityState={{ disabled: !canToggle }}
          disabled={!canToggle}
          onPress={() => setShow((s) => !s)}
          hitSlop={10}
          style={({ pressed }) => ({
            position: "absolute",
            right: 12,
            top: 0, // ← stretch full height
            bottom: 0, // ← stretch full height
            justifyContent: "center", // ← vertical center
            paddingHorizontal: 6,
            opacity: !canToggle ? 0.35 : pressed ? 0.6 : 1,
            minWidth: 44,
          })}
        >
          <Text style={{ color: "#2563EB", fontWeight: "600" }}>
            {show ? "Hide" : "Show"}
          </Text>
        </Pressable>
      </View>

      {/* Strength bar only when there's input AND showStrength=true */}
      {showStrength && value.length > 0 && (
        <View
          accessible
          accessibilityLabel={`Strength: ${strength.label}`}
          style={{ gap: 6 }}
        >
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 6,
                  backgroundColor:
                    i < strength.score ? strength.color : "#E5E7EB",
                }}
              />
            ))}
          </View>
          <Text style={{ fontSize: 12, color: theme.colors.subtext }}>
            {strength.label}
          </Text>
        </View>
      )}
    </View>
  );
}
