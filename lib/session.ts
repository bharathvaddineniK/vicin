import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { isGuestCached, isGuestNow } from "./authGuest";
import { supabase } from "./supabase";

export function useSession() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(isGuestCached()); // instant default

  useEffect(() => {
    (async () => {
      const g = await isGuestNow();
      console.log("[Guest] persisted?", g);
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
        console.log("[Gate] initial session?", !!data.session, "guest?", g);
      },
    );

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, s: Session | null) => {
        if (!mounted) return;
        setSession(s);
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { loading, session, isGuest, setIsGuest }; // expose if you want to flip it manually
}
