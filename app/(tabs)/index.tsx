import { endGuest } from "@/lib/authGuest";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";

export default function Home() {
  async function signOut() {
    try {
      await endGuest();
      await supabase.auth.signOut();
    } catch {}
    router.replace("/(auth)/login");
  }
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      <Text>Home</Text>
      <Pressable
        onPress={signOut}
        style={{ backgroundColor: "#ef4444", padding: 12, borderRadius: 12 }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>Sign out</Text>
      </Pressable>
    </View>
  );
}
