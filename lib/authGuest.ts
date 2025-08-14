import AsyncStorage from "@react-native-async-storage/async-storage";
const KEY = "GUEST_MODE";

// in-memory cache for immediate checks
let guestCached = false;

export async function startGuest() {
  guestCached = true; // immediate
  try {
    await AsyncStorage.setItem(KEY, "1");
  } catch {}
}

export async function endGuest() {
  guestCached = false;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}

export function isGuestCached() {
  return guestCached;
}

export async function isGuestNow() {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return false;
  }
}
