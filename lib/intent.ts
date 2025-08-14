import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";

const KEY = "INTENT_URL";

export async function saveIntent(url: string) {
  try {
    await AsyncStorage.setItem(KEY, url);
  } catch {}
}
export async function popIntent(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) await AsyncStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}

/** Turn any deep link into an internal string path like "/post/123?x=1" */
export function toInternalPath(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const path = "/" + (parsed.path ?? "");
    const qp = parsed.queryParams as
      | Record<string, string | number | boolean>
      | undefined;
    const query =
      qp && Object.keys(qp).length
        ? "?" +
          new URLSearchParams(
            Object.entries(qp).map(([k, v]) => [k, String(v)]),
          ).toString()
        : "";
    return path + query;
  } catch {
    return null;
  }
}
