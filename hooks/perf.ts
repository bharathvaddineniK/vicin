import { useEffect, useRef } from "react";
import { Platform } from "react-native";

/**
 * Logs FPS periodically (DEV only). Warns when FPS drops below `warnBelow`.
 * Lightweight rAF loop; no native deps.
 */
export function useFps(name: string = "app", warnBelow: number = 45) {
  if (!__DEV__) return;
  const frames = useRef(0);
  const lastT = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const lastLog = useRef<number>(Date.now());

  useEffect(() => {
    const tick = (t: number) => {
      if (lastT.current == null) lastT.current = t;
      frames.current = 1;
      const elapsed = t - lastT.current;
      if (elapsed >= 1000) {
        const fps = Math.round((frames.current * 1000) / elapsed);
        const now = Date.now();
        // Log every ~2s to avoid spam
        if (now - lastLog.current > 2000) {
          const tag = `[FPS:${name}]`;
          if (Platform.OS === "android" && fps < warnBelow) {
            // eslint-disable-next-line no-console
            console.warn(`${tag} ${fps}`);
          } else {
            // eslint-disable-next-line no-console
            console.log(`${tag} ${fps}`);
          }
          lastLog.current = now;
        }
        frames.current = 0;
        lastT.current = t;
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      rafId.current = null;
      lastT.current = null;
      frames.current = 0;
    };
  }, [name, warnBelow]);
}

/**
 * Counts renders of a component (DEV only).
 * Useful to detect accidental re-renders.
 */
export function useRenderCounter(label: string) {
  if (!__DEV__) return;
  const count = useRef(0);
  count.current = 1;
  // eslint-disable-next-line no-console
  console.log(`[RENDER:${label}] #${count.current}`);
}

/**
 * Drop-in marker you can place anywhere in JSX to log renders of a subtree.
 * Renders nothing. DEV-only side effect.
 */
export function PerfMarker({ label }: { label: string }) {
  useRenderCounter(label);
  return null;
}
