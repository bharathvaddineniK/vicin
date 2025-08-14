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
  return hasToken || hasType;
}

export default function DeepLinkAgent() {
  useEffect(() => {
    const handleUrl = async (url: string) => {
      // 1) Supabase OAuth/OTP links → let your existing handler do setSession + route
      if (isSupabaseReturn(url)) {
        // your existing OAuth/etc consumption code runs elsewhere
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
