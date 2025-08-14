import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect } from "react";
import { supabase } from "./supabase";

function parseKV(s: string) {
  return s.split("&").reduce<Record<string, string>>((acc, pair) => {
    const [k, v] = pair.split("=");
    if (k) acc[decodeURIComponent(k)] = decodeURIComponent(v || "");
    return acc;
  }, {});
}

async function waitForSession(timeoutMs = 2000, stepMs = 100) {
  const t0 = Date.now();
  // quick immediate check
  const first = await supabase.auth.getSession();
  if (first.data.session) return true;
  // short poll (max ~2s)
  while (Date.now() - t0 < timeoutMs) {
    await new Promise((r) => setTimeout(r, stepMs));
    const { data } = await supabase.auth.getSession();
    if (data.session) return true;
  }
  return false;
}

async function consumeSupabaseUrl(
  url: string,
): Promise<{ ok: boolean; type?: string }> {
  if (!url) return { ok: false };

  // Ignore error callback events (e.g., second tap emits otp_expired)
  const parsedErr = Linking.parse(url);
  if (typeof parsedErr.queryParams?.error === "string") {
    console.log("[DL] ignoring error callback:", parsedErr.queryParams);
    return { ok: false };
  }

  // 1) ?code=... — magic/verify
  try {
    const parsed = Linking.parse(url);
    const code =
      typeof parsed.queryParams?.code === "string"
        ? parsed.queryParams.code
        : undefined;
    const type =
      typeof parsed.queryParams?.type === "string"
        ? (parsed.queryParams!.type as string)
        : undefined;
    if (code) {
      // @ts-ignore
      const r = await supabase.auth.exchangeCodeForSession(code);
      console.log("[DL] exchangeCodeForSession →", r?.error ?? "ok");
      if (!r?.error) return { ok: true, type };
    }
  } catch (e: any) {
    console.log("[DL] exchangeCodeForSession THROW:", e?.message);
  }

  // 2) #access_token=...&refresh_token=... — recovery/verify
  try {
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
    if (hash) {
      const kv = parseKV(hash);
      const at = kv["access_token"];
      const rt = kv["refresh_token"];
      const type = kv["type"];
      if (at && rt) {
        const r = await supabase.auth.setSession({
          access_token: at,
          refresh_token: rt,
        });
        console.log("[DL] setSession →", r?.error ?? "ok");
        if (!r?.error) return { ok: true, type };
      }
    }
  } catch (e: any) {
    console.log("[DL] setSession THROW:", e?.message);
  }

  return { ok: false };
}

/** Global deep‑link agent that routes only AFTER the session is live */
export default function DeepLinkAgent() {
  useEffect(() => {
    console.log("[DL] Agent mounted");

    async function handle(label: string, url?: string | null) {
      console.log(`[DL] ${label}:`, url);
      const u = url ?? (await Linking.getInitialURL());
      if (!u) return;

      const res = await consumeSupabaseUrl(u);
      console.log("[DL] consume result:", res);

      if (res.ok) {
        // ensure the auth session is actually available to the next screen
        await waitForSession();

        const t = res.type;
        if (t === "recovery") {
          console.log("[DL] routing → /password-reset");
          router.replace("/(auth)/password-reset");
        } else {
          console.log("[DL] routing → /");
          router.replace("/");
        }
      }
    }

    // initial + subsequent
    handle("initial");
    const sub = Linking.addEventListener("url", ({ url }) =>
      handle("event", url),
    );
    return () => sub.remove();
  }, []);

  return null;
}
