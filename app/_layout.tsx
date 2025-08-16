import { ensureMyProfile } from "@/lib/profile"; // 👈 add
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
      // If signed in (not guest), ensure profile is initialized and completed
      if (session) {
        const me = await ensureMyProfile();
        const needsProfile = !me?.display_name || !me?.handle;
        if (needsProfile) {
          if (currentRoot.current !== "/(onboarding)/profile") {
            currentRoot.current = "/(onboarding)/profile";
            router.replace("/(onboarding)/profile" as Href);
          }
          SplashScreen.hideAsync().catch(() => {});
          return;
        }
      }

      // Any stored deep link intent for authed/guest users
      if (session || isGuest) {
        const intentUrl = await popIntent();
        if (intentUrl) {
          const internal = toInternalPath(intentUrl);
          if (internal) {
            router.replace(internal as Href);
            SplashScreen.hideAsync().catch(() => {});
            currentRoot.current = "INTENT";
            return;
          }
        }
      }

      // Default root
      const isAuthed = !!session || isGuest;
      const nextRoot = isAuthed ? "/(tabs)" : "/(auth)/login";
      if (currentRoot.current !== nextRoot) {
        currentRoot.current = nextRoot;
        router.replace(nextRoot as Href);
      }
      SplashScreen.hideAsync().catch(() => {});
    };

    go();
  }, [loading, session, router, isGuest]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Auth */}
      <Stack.Screen name="(auth)/login" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(auth)/signup" options={{ gestureEnabled: false }} />
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
      {/* Onboarding */}
      <Stack.Screen name="(onboarding)/profile" />
      {/* App */}
      <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(tabs)/index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="index" />
      {/* Legal */}
      <Stack.Screen name="legal/terms" />
      <Stack.Screen name="legal/privacy" />
    </Stack>
  );
}
