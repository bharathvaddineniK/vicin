import { assessPassword } from "@/lib/passwordStrength";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";
import PasswordField from "../components/PasswordField";

export default function PasswordResetFinish() {
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  async function updatePassword() {
    try {
      if (!newPw)
        return Alert.alert("Missing password", "Enter a new password.");
      // if (newPw.length < 6) return Alert.alert("Weak password", "Use at least 6 characters.");
      const strength = assessPassword(newPw.trim());
      if (!strength.meetsPolicy) {
        Alert.alert(
          "Choose a stronger password",
          "Use at least 8 characters with a mix of upper/lower, numbers, and a symbol.",
        );
        return;
      }
      setSaving(true);

      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;

      await supabase.auth.refreshSession();
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Update failed", e.message ?? "Try again.");
    } finally {
      setSaving(false);
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
      <Text style={{ fontSize: 22, fontWeight: "600" }}>
        Set a new password
      </Text>

      <PasswordField
        value={newPw}
        onChangeText={setNewPw}
        placeholder="New password"
        showStrength
      />

      <Pressable
        onPress={updatePassword}
        disabled={saving}
        style={({ pressed }) => ({
          opacity: saving || pressed ? 0.6 : 1,
          backgroundColor: "#2563eb",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        })}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>
          {saving ? "Saving..." : "Save new password"}
        </Text>
      </Pressable>
    </View>
  );
}
