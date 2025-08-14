import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "../../lib/supabase";

export default function Confirm() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setAuthed(!!data.session);

      const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
        if (mounted) setAuthed(!!session);
      });

      setReady(true);
      return () => sub.subscription.unsubscribe();
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Redirect href={authed ? "/(tabs)" : "/(auth)/login"} />;
}
