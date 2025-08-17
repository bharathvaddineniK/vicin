import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

const APP_SCHEME = process.env.APP_SCHEME || "vicinapp";

/** Build stable proxy URL in Expo Go; scheme in dev client/release */
function getExpoProxyRedirectUri() {
  const owner =
    (Constants as any).expoConfig?.owner ??
    (Constants as any).manifest2?.extra?.expoClient?.owner ??
    (Constants as any).manifest?.owner;
  const slug =
    (Constants as any).expoConfig?.slug ??
    (Constants as any).manifest2?.extra?.expoClient?.slug ??
    (Constants as any).manifest?.slug;

  const path = "oauth-callback";
  if (owner && slug) return `https://auth.expo.dev/@${owner}/${slug}/${path}`;
  return (AuthSession.makeRedirectUri as any)({ useProxy: true, path });
}

function getRedirectUri() {
  const isExpoGo = Constants.appOwnership === "expo";
  if (isExpoGo) {
    const uri = getExpoProxyRedirectUri();
    // console.log("[OAuth] Redirect (proxy, stable):", uri);
    return uri;
  }
  const uri = Linking.createURL("oauth-callback", { scheme: APP_SCHEME });
  // console.log("[OAuth] Redirect (scheme):", uri);
  return uri;
}

async function openProviderUrl(
  authUrl: string,
  returnUrl: string,
  opts?: { ephemeral?: boolean },
) {
  // Use the secure auth session flow so it returns to your app via `returnUrl`
  const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl, {
    showInRecents: true,
    preferEphemeralSession: !!opts?.ephemeral, // iOS: avoids staying signed in the browser
  });
  // console.log("[OAuth] browser result:", result.type);
  // Result types: "success" (deep link consumed), "dismiss", "cancel"
  return result;
}

export async function signInWithGoogle() {
  const redirectTo = getRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { prompt: "select_account" },
      // keep skipBrowserRedirect=false (default); we’ll open manually
    },
  });
  if (error) {
    // console.log("[OAuth] Google error:", error.message);
    throw error;
  }
  const authUrl = data?.url;
  if (authUrl) await openProviderUrl(authUrl, redirectTo);
  else await Linking.openURL(redirectTo); // extreme fallback
}

export async function signInWithApple() {
  const redirectTo = getRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: { redirectTo },
  });
  if (error) {
    // console.log("[OAuth] Apple error:", error.message);
    throw error;
  }
  const authUrl = data?.url;
  // For Apple on iOS, ephemeral reduces prompts and is HIG-friendly
  if (authUrl) await openProviderUrl(authUrl, redirectTo, { ephemeral: true });
  else await Linking.openURL(redirectTo);
}
