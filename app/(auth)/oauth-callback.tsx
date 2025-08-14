import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

export default function OAuthCallback() {
  useEffect(() => {
    // let the DeepLinkAgent consume tokens, then route home
    const t = setTimeout(() => router.replace("/"), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
