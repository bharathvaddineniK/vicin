import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "../../lib/supabase";

const RESET_REDIRECT = "vicinapp://password-reset";

export default function Reset() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<NodeJS.Timeout | null>(null);

  function startCooldown(seconds = 45) {
    setCooldown(seconds);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (timer.current) clearInterval(timer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  async function onReset() {
    try {
      if (!email.trim())
        return Alert.alert("Missing email", "Please enter your email.");
      if (cooldown > 0) return;
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: RESET_REDIRECT,
      });
      if (error) throw error;
      Alert.alert(
        "Email sent",
        "Open the link on this device to reset your password.",
      );
      startCooldown(45);
    } catch (e: any) {
      Alert.alert("Reset failed", e.message ?? "Try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        justifyContent: "center",
        gap: 12,
        backgroundColor: "#f8fafc",
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "600" }}>Reset password</Text>
      <TextInput
        placeholder="Email"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="username"
        value={email}
        onChangeText={setEmail}
        style={{
          backgroundColor: "#fff",
          color: "#0f172a",
          borderWidth: 1,
          borderColor: "#cbd5e1",
          borderRadius: 12,
          padding: 12,
        }}
      />
      <Pressable
        onPress={onReset}
        disabled={loading || cooldown > 0}
        style={({ pressed }) => ({
          opacity: pressed || loading || cooldown > 0 ? 0.6 : 1,
          backgroundColor: "#2563eb",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        })}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>
          {loading
            ? "Sending..."
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : "Send reset link"}
        </Text>
      </Pressable>

      <View
        style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}
      >
        <Text>Back to </Text>
        <Pressable
          hitSlop={8}
          onPress={() => router.push("/(auth)/login")}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ color: "#2563eb", fontWeight: "600" }}>Sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}
