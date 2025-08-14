import { Stack } from "expo-router";
import DeepLinkAgent from "../lib/deeplink";

export default function RootLayout() {
  return (
    <>
      <DeepLinkAgent />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/signup" />
        <Stack.Screen name="(auth)/reset" />
        <Stack.Screen name="(auth)/verify-code" />
        <Stack.Screen
          name="(auth)/password-reset"
          options={{ animation: "none" }}
        />
        <Stack.Screen name="(auth)/confirm" />
        <Stack.Screen name="(tabs)/index" />
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}
