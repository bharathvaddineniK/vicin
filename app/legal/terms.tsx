import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LegalHeader from "../../components/LegalHeader";

export default function TermsScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#FFF" }}
      edges={["top", "bottom"]}
    >
      <LegalHeader title="Terms & Conditions" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ color: "#475569" }}>Last updated: 2025‑08‑14</Text>
        <View style={{ gap: 12 }}>
          {/* Replace with real Terms; these are placeholders */}
          <Text style={{ fontWeight: "700" }}>1. Overview</Text>
          <Text>
            Vicin is a community utility for posting events, updates, and help
            requests.
          </Text>

          <Text style={{ fontWeight: "700" }}>2. Eligibility</Text>
          <Text>13+ only. We do not store full DOB; age‑gate only.</Text>

          <Text style={{ fontWeight: "700" }}>3. Content & Moderation</Text>
          <Text>
            No violence, hate speech, bullying, scams, 18+ content,
            impersonation, or plagiarism.
          </Text>

          <Text style={{ fontWeight: "700" }}>4. Data Retention</Text>
          <Text>
            Activity retained 30 days; post‑linked activity expires with posts.
          </Text>

          <Text style={{ fontWeight: "700" }}>5. Calling</Text>
          <Text>Calls use number relay—phone numbers are never revealed.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
