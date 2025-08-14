import { Image, Text, View } from "react-native";

export default function AuthHeader({ tagline }: { tagline: string }) {
  return (
    <View
      style={{
        alignItems: "center",
        gap: 12,
        paddingTop: 24,
        paddingBottom: 8,
      }}
    >
      <Image
        source={require("../assets/logo.png")}
        accessibilityLabel="Vicin logo"
        resizeMode="contain"
        style={{ width: 128, height: 128, borderRadius: 24 }}
      />
      <Text
        style={{
          color: "#0f172a",
          fontSize: 16,
          fontWeight: "500",
          letterSpacing: 0.2,
        }}
      >
        {tagline}
      </Text>
    </View>
  );
}
