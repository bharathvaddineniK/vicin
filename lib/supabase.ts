import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      // CRUCIAL for React Native persistence:
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      // We handle deep links ourselves; don’t look for query params in the URL:
      detectSessionInUrl: false,
    },
  },
);
