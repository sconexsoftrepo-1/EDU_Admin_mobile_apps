"use client";
import { useSyncExternalStore } from "react";
function subscribeResize(callback: () => void) {
  window.addEventListener("resize", callback, { passive: true });
  return () => window.removeEventListener("resize", callback);
}
function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}
export function useScenePerformance() {
  const width = useSyncExternalStore(
    subscribeResize,
    () => innerWidth,
    () => 1024,
  );
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden",
    () => true,
  );
  return {
    variant:
      width < 600
        ? ("mobile" as const)
        : width < 1100
          ? ("tablet" as const)
          : ("desktop" as const),
    visible,
  };
}
