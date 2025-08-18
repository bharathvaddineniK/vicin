import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect } from "react";
import { isGuestNow } from "./authGuest";
import { isProtectedPath } from "./guard";
import { saveIntent } from "./intent";
import { supabase } from "./supabase";

function isSupabaseReturn(url: string) {
  // very simple check: fragment contains access_token OR type=recovery/signup
  const hasToken = url.includes("#access_token=");
  const hasType = /[?&#]type=(recovery|signup)/.test(url);
  const isSupabaseUrl = hasToken || hasType;
  console.log("[DeepLink] URL:", url);
  console.log("[DeepLink] Is Supabase return:", isSupabaseUrl, { hasToken, hasType });
  return isSupabaseUrl;
}

export default function DeepLinkAgent() {
  useEffect(() => {
    const handleUrl = async (url: string) => {
      // 1) Supabase OAuth/OTP links → process the session
      if (isSupabaseReturn(url)) {
        console.log("[DeepLink] Processing Supabase OAuth callback");
        try {
          // For OAuth callbacks, Supabase will automatically handle the session
          // We just need to trigger a session refresh
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            console.error("[DeepLink] OAuth session refresh error:", error);
            // Try to get the current session instead
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session) {
              console.log("[DeepLink] OAuth session found via getSession");
              router.replace("/(tabs)");
            }
          } else if (data.session) {
            console.log("[DeepLink] OAuth session established successfully");
            router.replace("/(tabs)");
          } else {
            console.log("[DeepLink] No session found in OAuth callback");
          }
        } catch (error) {
          console.error("[DeepLink] Error processing OAuth callback:", error);
        }
        return;
      }

      // 2) Regular deep links → guard
      const parsed = Linking.parse(url);
      const path = "/" + (parsed.path ?? "");

      // If protected and not signed in, save intent and go to login
      const { data } = await supabase.auth.getSession();
      const guest = await isGuestNow();
      if (isProtectedPath(path) && !data.session && !guest) {
        await saveIntent(url);
        router.replace("/(auth)/login");
        return;
      }

      // Otherwise allow routing
      // Example: router.push(url); (often unnecessary if you already handle nav elsewhere)
    };

    // initial
    Linking.getInitialURL().then((u) => {
      if (u) handleUrl(u);
    });

    // events
    const sub = Linking.addEventListener("url", (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);

  return null;
}
