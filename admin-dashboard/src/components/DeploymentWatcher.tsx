"use client";
import { useEffect } from "react";
import { clearWorkspaceCache, forgetWorkspaceSession } from "@/lib/colleges/workspace-cache";

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
const RELOADED_KEY = "edunexa-reloaded-for-build";
const CHECK_EVERY_MS = 5 * 60_000;

/**
 * After a new dashboard deployment, open tabs drop what they saved from the old version (menu,
 * screens, cached lists) and reload once to run the new code. The sign-in stays (HttpOnly cookies).
 */
export default function DeploymentWatcher() {
  useEffect(() => {
    if (BUILD === "dev") return;
    let stopped = false;
    async function check() {
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok || stopped) return;
        const { build } = (await response.json()) as { build?: string };
        if (!build || build === "dev" || build === BUILD) return;
        // Reload only once per new build, so a mismatch can never loop.
        let already = null;
        try {
          already = sessionStorage.getItem(RELOADED_KEY);
          sessionStorage.setItem(RELOADED_KEY, build);
        } catch {
          /* Storage disabled: still reload once below. */
        }
        if (already === build) return;
        clearWorkspaceCache();
        forgetWorkspaceSession();
        window.location.reload();
      } catch {
        /* Offline or server busy: try again later. */
      }
    }
    void check();
    const onFocus = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onFocus);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
