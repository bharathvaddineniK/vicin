import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "../../lib/supabase";
import AuthHeader from "../components/AuthHeader";
import PasswordField from "../components/PasswordField";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const key = showPw ? "login-show" : "login-hide";

  async function onLogin() {
    try {
      if (!email.trim())
        return Alert.alert("Missing email", "Please enter your email.");
      if (!password)
        return Alert.alert("Missing password", "Please enter your password.");
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (!data?.session)
        return Alert.alert("Sign in", "Signed in but no session returned.");
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Sign in failed", e.message ?? "Check your credentials");
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
      <AuthHeader tagline="Back to your neighborhood buzz" />
      <Text style={{ fontSize: 24, fontWeight: "600" }}>Welcome back</Text>

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

      <PasswordField value={password} onChangeText={setPassword} />

      <Pressable
        onPress={onLogin}
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
          {loading ? "Signing in..." : "Sign in"}
        </Text>
      </Pressable>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 8,
          alignItems: "center",
        }}
      >
        <Pressable
          hitSlop={8}
          onPress={() => router.push("/(auth)/reset")}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ color: "#2563eb" }}>Forgot password?</Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text>New here? </Text>
          <Pressable
            hitSlop={8}
            onPress={() => router.push("/(auth)/signup")}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: "#2563eb", fontWeight: "600" }}>
              Create account
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={() => router.replace("/(tabs)")}
        style={({ pressed }) => ({
          opacity: pressed ? 0.6 : 1,
          padding: 12,
          borderRadius: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "#cbd5e1",
          marginTop: 8,
        })}
      >
        <Text style={{ fontWeight: "600" }}>Continue as guest</Text>
      </Pressable>
    </View>
  );
}
