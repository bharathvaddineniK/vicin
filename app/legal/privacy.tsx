import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LegalHeader from "../../components/LegalHeader";

export default function PrivacyScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#FFF" }}
      edges={["top", "bottom"]}
    >
      <LegalHeader title="Privacy Policy" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ color: "#475569" }}>Last updated: 2025‑08‑14</Text>
        <View style={{ gap: 12 }}>
          {/* Replace with real Privacy; these are placeholders */}
          <Text style={{ fontWeight: "700" }}>Data Minimization</Text>
          <Text>No full DOB stored; minimal profile fields only.</Text>

          <Text style={{ fontWeight: "700" }}>Location</Text>
          <Text>
            Used for map pins and nearby content with explicit consent.
          </Text>

          <Text style={{ fontWeight: "700" }}>Retention</Text>
          <Text>
            Posts and related activity auto‑expire per settings; default 30
            days.
          </Text>

          <Text style={{ fontWeight: "700" }}>Calling</Text>
          <Text>Phone relay; participants’ numbers are never shown.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
