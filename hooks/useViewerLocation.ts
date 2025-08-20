import { supabase } from "@/lib/supabase";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

export function useViewerLocation() {
  const [state, setState] = useState<{
    lat: number | null;
    lng: number | null;
    radiusM: number | null;
    ready: boolean;
  }>({ lat: null, lng: null, radiusM: null, ready: false });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) Try device GPS (no prompt if already granted)
        let lat: number | null = null;
        let lng: number | null = null;

        if (Platform.OS === "ios" || Platform.OS === "android") {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              mayShowUserSettingsDialog: false,
            });
            lat = loc.coords.latitude;
            lng = loc.coords.longitude;
          }
        }

        // 2) Fallback to profile.home_location (and radius)
        let radiusM: number | null = null;
        if (
          lat == null ||
          lng == null ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user?.id) {
            const { data, error } = await supabase
              .from("profiles")
              .select("home_location, home_radius_m")
              .eq("id", user.id)
              .maybeSingle();
            if (!error && data) {
              // Supabase returns PostGIS geography as GeoJSON (lng,lat)
              const geo: any = data.home_location;
              if (geo && geo.coordinates && Array.isArray(geo.coordinates)) {
                const [lng0, lat0] = geo.coordinates as [number, number];
                lat = lat0 ?? lat;
                lng = lng0 ?? lng;
              }
              radiusM = Number.isFinite(data.home_radius_m)
                ? Number(data.home_radius_m)
                : 8047; // default 5 miles
            }
          }
        }

        // 3) Defaults if still missing
        if (radiusM == null) radiusM = 8047;

        if (!cancelled) {
          setState({
            lat: lat ?? null,
            lng: lng ?? null,
            radiusM,
            ready: lat != null && lng != null,
          });
        }
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, ready: false }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
