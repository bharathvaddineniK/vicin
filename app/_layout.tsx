import type { Href } from "expo-router";
import { SplashScreen, Stack, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { popIntent, toInternalPath } from "../lib/intent";
import { useSession } from "../lib/session";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { loading, session, isGuest } = useSession();
  const router = useRouter();
  const currentRoot = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    const go = async () => {
      if (session || isGuest) {
        // If a protected deep link was attempted, honor it once
        const intentUrl = await popIntent();
        if (intentUrl) {
          const internal = toInternalPath(intentUrl);
          if (internal) {
            router.replace(internal as Href); // ✅ cast to Href
            SplashScreen.hideAsync().catch(() => {});
            currentRoot.current = "INTENT";
            return;
          }
        }
      }
      const isAuthed = !!session || isGuest;
      // Otherwise go to the default root
      const nextRoot = isAuthed ? "/(tabs)" : "/(auth)/login";
      if (currentRoot.current !== nextRoot) {
        currentRoot.current = nextRoot;
        router.replace(nextRoot);
      }
      SplashScreen.hideAsync().catch(() => {});
    };

    go();
  }, [loading, session, router, isGuest]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Auth */}
      <Stack.Screen name="(auth)/login" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(auth)/signup" />
      <Stack.Screen name="(auth)/reset" />
      <Stack.Screen
        name="(auth)/password-reset"
        options={{ animation: "none" }}
      />
      <Stack.Screen name="(auth)/verify-code" />
      <Stack.Screen name="(auth)/confirm" />
      <Stack.Screen
        name="(auth)/oauth-callback"
        options={{ animation: "none" }}
      />
      {/* App */}
      {/* <Stack.Screen name="(tabs)/index" /> */}
      <Stack.Screen name="index" />
      {/* Legal */}
      <Stack.Screen name="legal/terms" />
      <Stack.Screen name="legal/privacy" />
    </Stack>
  );
}
