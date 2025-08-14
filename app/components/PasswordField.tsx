import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { assessPassword } from "../../lib/passwordStrength";
import StrengthBar from "./StrengthBar";

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  showStrength?: boolean; // <- turn meter on/off per screen
  testID?: string;
};

export default function PasswordField({
  value,
  onChangeText,
  placeholder = "Password",
  showStrength = false,
  testID,
}: Props) {
  const [show, setShow] = useState(false);
  const canToggle = value.length > 0;

  const strength = useMemo(() => assessPassword(value), [value]);

  return (
    <View style={{ gap: 8 }}>
      <View style={{ position: "relative" }}>
        <TextInput
          testID={testID}
          placeholder={placeholder}
          placeholderTextColor="#6b7280"
          secureTextEntry={!show}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          // helps suppress iOS strong-password interstitial
          textContentType="oneTimeCode"
          autoComplete="off"
          style={{
            backgroundColor: "#fff",
            color: "#0f172a",
            borderWidth: 1,
            borderColor: "#cbd5e1",
            borderRadius: 12,
            padding: 12,
            paddingRight: 64,
          }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={show ? "Hide password" : "Show password"}
          disabled={!canToggle}
          onPress={() => setShow((s) => !s)}
          hitSlop={10}
          style={({ pressed }) => ({
            position: "absolute",
            right: 12,
            top: 10,
            padding: 6,
            opacity: !canToggle ? 0.35 : pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ color: "#2563eb", fontWeight: "600" }}>
            {show ? "Hide" : "Show"}
          </Text>
        </Pressable>
      </View>

      {/* Strength bar only when there's input AND showStrength=true */}
      {showStrength && value.length > 0 && (
        <StrengthBar
          score={strength.score}
          color={strength.color}
          label={strength.label}
        />
      )}
    </View>
  );
}
