import { apiUrl } from "@/services/api/config";

/** Private document URLs use the dashboard's authenticated cookie proxy. Storage keys aren't URLs. */
export function personPhotoUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const path = value.trim();
  const internal = path.replace(/^\/?api\/v1\//, "");
  if (internal !== path) return apiUrl(internal);
  if (path.startsWith("/api/college/")) return path;
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      if (url.pathname.startsWith("/api/v1/documents/"))
        return apiUrl(url.pathname.replace(/^\/api\/v1\//, "") + url.search);
      return path;
    } catch {
      return "";
    }
  }
  if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(path)) return path;
  return "";
}

export function courseLevelLabel(value: unknown): string {
  const level = String(value || "")
    .trim()
    .toLowerCase();
  if (["inter", "intermediate"].includes(level)) return "Intermediate";
  if (level === "degree") return "Degree";
  return level ? level.charAt(0).toUpperCase() + level.slice(1) : "—";
}
