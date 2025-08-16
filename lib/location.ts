// /lib/location.ts
import * as Location from "expo-location";

/** Ask for foreground location permission. */
export async function requestForeground(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> {
  const { status, canAskAgain } =
    await Location.requestForegroundPermissionsAsync();
  return { granted: status === "granted", canAskAgain };
}

/** Get a single fix with balanced accuracy (no web-only options). */
export async function getOneShot(): Promise<{
  latitude: number;
  longitude: number;
}> {
  let p = await Location.getForegroundPermissionsAsync();
  if (p.status !== "granted") {
    p = await Location.requestForegroundPermissionsAsync();
    if (p.status !== "granted") {
      throw new Error(
        "Location is required to post. Please allow or choose on map.",
      );
    }
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
    // On Android this can surface the system dialog if location is off:
    mayShowUserSettingsDialog: true,
  });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}
