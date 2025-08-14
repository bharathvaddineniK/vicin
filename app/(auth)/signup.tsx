import { assessPassword } from "@/lib/passwordStrength";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Switch, Text, TextInput, View } from "react-native";
import { supabase } from "../../lib/supabase";
import AuthHeader from "../components/AuthHeader";
import PasswordField from "../components/PasswordField";

const REDIRECT = "vicinapp://confirm";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [over13, setOver13] = useState(false);
  const [accept, setAccept] = useState(false);

  const [loadingSignup, setLoadingSignup] = useState(false);
  const [showPostSend, setShowPostSend] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<NodeJS.Timeout | null>(null);

  function startCooldown(seconds = 30) {
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

  async function onSignup() {
    try {
      const pwd = password.trim();
      if (!email.trim())
        return Alert.alert("Missing email", "Please enter your email.");
      if (!password)
        return Alert.alert("Missing password", "Please enter a password.");
      // if (password.length < 6) return Alert.alert("Weak password", "Use at least 6 characters.");
      if (!over13)
        return Alert.alert("Age requirement", "You must confirm you are 13+.");
      if (!accept)
        return Alert.alert("Terms", "Please accept Terms & Privacy.");

      const strength = assessPassword(pwd);
      if (!strength.meetsPolicy) {
        // You can surface strength.reasons.join("\n") too
        Alert.alert(
          "Choose a stronger password",
          "Use at least 8 characters with a mix of upper/lower, numbers, and a symbol.",
        );
        return;
      }

      setLoadingSignup(true);
      setShowPostSend(false);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: REDIRECT },
      });

      const alreadyRegistered =
        !error &&
        data?.user &&
        Array.isArray((data.user as any).identities) &&
        (data.user as any).identities.length === 0;

      if (error || alreadyRegistered) {
        const msg = (error?.message || "").toLowerCase();
        if (
          alreadyRegistered ||
          msg.includes("already") ||
          msg.includes("registered") ||
          msg.includes("exists")
        ) {
          Alert.alert(
            "Account already exists",
            "This email is already confirmed. Please Sign in or use Reset password.",
          );
          return;
        }
        throw error;
      }

      Alert.alert(
        "Check your email",
        "We sent a verification email with a link and a code.",
      );
      setShowPostSend(true);
      startCooldown(30);
    } catch (e: any) {
      Alert.alert("Sign up failed", e?.message ?? "Try again later.");
    } finally {
      setLoadingSignup(false);
    }
  }

  async function onResend() {
    try {
      if (!email.trim())
        return Alert.alert("Missing email", "Enter your email first.");
      if (cooldown > 0) return;
      setResending(true);
      // @ts-ignore
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: REDIRECT },
      });
      if (error) throw error;
      Alert.alert("Sent", "Verification email resent. Check your inbox.");
      startCooldown(30);
    } catch (e: any) {
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("rate") || msg.includes("limit")) {
        Alert.alert(
          "Slow down",
          "You’re trying too often. Please wait and try again.",
        );
      } else if (msg.includes("not pending") || msg.includes("not found")) {
        Alert.alert(
          "No pending confirmation",
          "This email may already be confirmed. Try Sign in or Reset password.",
        );
      } else {
        Alert.alert("Could not resend", e?.message ?? "Try again later.");
      }
    } finally {
      setResending(false);
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
      <AuthHeader tagline="Your world within 5 miles" />
      <Text style={{ fontSize: 24, fontWeight: "600" }}>Create account</Text>

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

      <PasswordField value={password} onChangeText={setPassword} showStrength />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginTop: 6,
        }}
      >
        <Switch
          value={over13}
          onValueChange={setOver13}
          trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
          thumbColor={over13 ? "#2563eb" : "#f8fafc"}
        />
        <Text>I confirm I’m 13+.</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Switch
          value={accept}
          onValueChange={setAccept}
          trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
          thumbColor={accept ? "#2563eb" : "#f8fafc"}
        />
        <Text>
          I accept the <Text style={{ color: "#2563eb" }}>Terms</Text> &{" "}
          <Text style={{ color: "#2563eb" }}>Privacy</Text>.
        </Text>
      </View>

      <Pressable
        onPress={onSignup}
        disabled={loadingSignup}
        accessibilityRole="button"
        style={({ pressed }) => ({
          opacity: pressed || loadingSignup ? 0.6 : 1,
          backgroundColor: "#2563eb",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        })}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>
          {loadingSignup ? "Creating..." : "Create account"}
        </Text>
      </Pressable>

      {showPostSend && (
        <View style={{ alignSelf: "flex-start", marginTop: 4 }}>
          <Pressable
            onPress={onResend}
            disabled={resending || cooldown > 0}
            accessibilityRole="button"
            style={({ pressed }) => ({
              opacity: pressed || resending || cooldown > 0 ? 0.5 : 1,
              paddingVertical: 8,
            })}
          >
            <Text style={{ color: "#2563eb" }}>
              {resending
                ? "Resending..."
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend verification email"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(auth)/verify-code",
                params: { email },
              })
            }
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
              paddingVertical: 8,
            })}
          >
            <Text style={{ color: "#2563eb" }}>Enter code instead</Text>
          </Pressable>
        </View>
      )}

      <View
        style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}
      >
        <Text>Already have an account? </Text>
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
