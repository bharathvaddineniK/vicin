import AuthHeader from "@/components/AuthHeader";
import PasswordField from "@/components/PasswordField";
import { AppleButton, GoogleButton } from "@/components/SocialButtons";
import { authErrorToAlertMessage } from "@/lib/authError";
import { startGuest } from "@/lib/authGuest";
import { signInWithApple, signInWithGoogle } from "@/lib/oauth";
import { useSession } from "@/lib/session";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const { setIsGuest } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const key = showPw ? "login-show" : "login-hide";
  const [busy, setBusy] = useState<null | "google" | "apple">(null);
  const continuingRef = useRef(false);
  const [continuing, setContinuing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => sub.remove();
    }, []),
  );

  async function onGoogle() {
    if (busy) return;
    setBusy("google");
    try {
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert("Google sign-in failed", e?.message ?? "Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onApple() {
    if (busy) return;
    setBusy("apple");
    try {
      await signInWithApple();
    } catch (e: any) {
      Alert.alert("Apple sign-in failed", e?.message ?? "Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onLogin() {
    try {
      if (!email.trim())
        return Alert.alert("Missing email", "Please enter your email.");
      if (!password)
        return Alert.alert("Missing password", "Please enter your password.");
      setLoading(true);
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        Alert.alert("Can’t sign in", authErrorToAlertMessage(error.message));
        return;
      }
      // if (error) throw error;
      if (!data?.session)
        return Alert.alert("Sign in", "Signed in but no session returned.");
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Sign in failed", e.message ?? "Check your credentials");
    } finally {
      setLoading(false);
    }
  }

  async function onContinueAsGuest() {
    if (continuingRef.current) return;
    continuingRef.current = true;
    setContinuing(true);

    try {
      await startGuest();
      setIsGuest(true);
      router.replace("/(tabs)");             
    } catch (e) {
      continuingRef.current = false;
      setContinuing(false);
      Alert.alert("Oops", "Try again.");
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
        onPress={onContinueAsGuest}
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

      <View style={{ height: 8 }} />
      <GoogleButton onPress={onGoogle} disabled={!!busy} />
      <View style={{ height: 8 }} />
      <AppleButton onPress={onApple} disabled={!!busy} />
    </View>
  );
}
