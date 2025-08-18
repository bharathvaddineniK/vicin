import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { endGuest, isGuestCached, isGuestNow } from "./authGuest";
import { migrateGuestPrefsToProfile } from "./migrateGuest";
import { supabase } from "./supabase";

export function useSession() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(isGuestCached()); // instant default

  useEffect(() => {
    (async () => {
      const g = await isGuestNow();
      // console.log("[Guest] persisted?", g);
    })();
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.all([supabase.auth.getSession(), isGuestNow()]).then(
      ([{ data }, g]) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setIsGuest(g);
        setLoading(false);
        // console.log("[Gate] initial session?", !!data.session, "guest?", g);
      },
    );

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, s: Session | null) => {
        console.log("[Session] Auth state change:", event, s ? "session exists" : "no session");
        if (!mounted) return;
        const hadNoSession = !session;
        setSession(s);
        if (s) {
          console.log("[Session] User authenticated:", s.user.email);
          endGuest().catch(() => {});
          setIsGuest(false);
        }
        if (s && hadNoSession) {
          console.log("[Session] Migrating guest preferences");
          await migrateGuestPrefsToProfile();
        }
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { loading, session, isGuest, setIsGuest }; // expose if you want to flip it manually
}
