import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "../../lib/supabase";

export default function VerifyCode() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function onVerify() {
    try {
      if (!email.trim())
        return Alert.alert("Missing email", "Enter your email.");
      if (!token.trim())
        return Alert.alert(
          "Missing code",
          "Enter the 6‑digit code from the email.",
        );
      setLoading(true);

      const { error } = await supabase.auth.verifyOtp({
        type: "signup",
        email,
        token: token.trim(), // must match {{ .Token }} (short code)
      });
      if (error) throw error;

      const { data } = await supabase.auth.getSession();
      router.replace(data.session ? "/(tabs)" : "/(auth)/login");
    } catch (e: any) {
      Alert.alert(
        "Verification failed",
        e.message ?? "Code may be expired. Try resending.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    try {
      if (!email.trim())
        return Alert.alert("Missing email", "Enter your email first.");
      // @ts-ignore
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      Alert.alert("Sent", "We resent the email with a fresh code and link.");
    } catch (e: any) {
      Alert.alert("Could not resend", e.message ?? "Try again later.");
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
      <Text style={{ fontSize: 24, fontWeight: "600" }}>Verify your email</Text>

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

      <TextInput
        placeholder="6‑digit code"
        placeholderTextColor="#6b7280"
        keyboardType="number-pad"
        value={token}
        onChangeText={(t) => setToken(t.replace(/\D/g, "").slice(0, 6))}
        style={{
          backgroundColor: "#fff",
          color: "#0f172a",
          borderWidth: 1,
          borderColor: "#cbd5e1",
          borderRadius: 12,
          padding: 12,
          letterSpacing: 4,
        }}
      />

      <Pressable
        onPress={onVerify}
        disabled={loading}
        style={({ pressed }) => ({
          opacity: pressed || loading ? 0.6 : 1,
          backgroundColor: "#2563eb",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        })}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>
          {loading ? "Verifying..." : "Verify"}
        </Text>
      </Pressable>

      <Pressable
        onPress={resend}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 8 })}
      >
        <Text style={{ color: "#2563eb" }}>Resend code</Text>
      </Pressable>
    </View>
  );
}
