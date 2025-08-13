import { Stack } from "expo-router";
export default function Root() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(tabs)/index" />
    </Stack>
  );
}
