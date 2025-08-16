// /lib/prefs.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
const KEY_PREFIX = "PREF_BANNER_LOCATION_"; // + (userId|guest)

export async function setLocationBannerSnooze(id: string, ms: number) {
  const until = Date.now() + ms;
  await AsyncStorage.setItem(KEY_PREFIX + id, String(until));
}

export async function isLocationBannerSnoozed(id: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + id);
  if (!raw) return false;
  const until = Number(raw);
  return Number.isFinite(until) && until > Date.now();
}

export async function clearLocationBannerSnooze(id: string) {
  await AsyncStorage.removeItem(KEY_PREFIX + id);
}
