"use client";
import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
const key = "kc-skyline-appearance";
const subscribe = (callback: () => void) => {
  window.addEventListener("skyline-theme", callback);
  window.addEventListener("storage", callback);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener("skyline-theme", callback);
    window.removeEventListener("storage", callback);
    media.removeEventListener("change", callback);
  };
};
const snapshot = () => {
  try {
    return localStorage.getItem(key) || "system";
  } catch {
    return "system";
  }
};
const systemDark = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;
export default function SkylineTheme() {
  const mode = useSyncExternalStore(subscribe, snapshot, () => "system");
  const darkSystem = useSyncExternalStore(subscribe, systemDark, () => false);
  const dark = mode === "dark" || (mode === "system" && darkSystem);
  const change = (value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {}
    document.documentElement.dataset.skylineTheme = value;
    window.dispatchEvent(new Event("skyline-theme"));
  };
  return (
    <div
      className="skyline-appearance"
      role="group"
      aria-label="Theme controls"
    >
      <button
        className="skyline-theme-toggle"
        type="button"
        aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
        title={`Switch to ${dark ? "light" : "dark"} theme`}
        onClick={() => change(dark ? "light" : "dark")}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <label>
        <span className="skyline-theme-label">Appearance</span>
        <select
          aria-label="Skyline appearance"
          value={mode}
          onChange={(e) => change(e.target.value)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </label>
    </div>
  );
}
