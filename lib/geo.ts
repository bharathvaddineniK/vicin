import AsyncStorage from "@react-native-async-storage/async-storage";
const ORIGIN_KEY = "LOCAL_ORIGIN"; // {lat,lon,radius_m, source:"gps|manual|prompt-denied"}

export type LocalOrigin = {
  lat: number;
  lon: number;
  radius_m: number; // default 8047 (~5mi)
  source: "gps" | "manual" | "denied";
};

export async function saveLocalOrigin(o: LocalOrigin) {
  await AsyncStorage.setItem(ORIGIN_KEY, JSON.stringify(o));
}
export async function getLocalOrigin(): Promise<LocalOrigin | null> {
  const v = await AsyncStorage.getItem(ORIGIN_KEY);
  return v ? JSON.parse(v) : null;
}
export async function clearLocalOrigin() {
  await AsyncStorage.removeItem(ORIGIN_KEY);
}
