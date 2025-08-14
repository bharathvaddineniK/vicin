import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LegalHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomColor: "#E5E7EB",
        borderBottomWidth: 1,
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={() => router.back()}
        hitSlop={10}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ fontSize: 16, color: "#2563EB", fontWeight: "600" }}>
          Close
        </Text>
      </Pressable>

      <Text
        style={{ fontSize: 17, fontWeight: "700" }}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>

      {/* spacer to balance layout */}
      <View style={{ width: 56 }} />
    </View>
  );
}
