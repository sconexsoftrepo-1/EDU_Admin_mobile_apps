/**
 * EduNexa API configuration — the one place that defines where the dashboard sends API calls.
 *
 * Request flow
 * ------------
 *   Browser component
 *     -> api.<module>.<method>()                 (src/services/api/modules/<module>/service.ts)
 *     -> apiRequest()                            (src/services/api/client.ts)
 *     -> {API_CONFIG.proxyBaseUrl}/<path>        e.g. /api/college/auth/login
 *     -> Next.js proxy route                     (src/app/api/college/[...path]/route.ts)
 *          keeps the access/refresh tokens in httpOnly cookies and refreshes them
 *     -> {API_CONFIG.backendUrl}{API_CONFIG.backendPrefix}/<path>
 *                                                e.g. http://185.193.19.156:8010/api/v1/auth/login
 *     -> FastAPI backend (backend/), PostgreSQL on Supabase
 *
 * Endpoint paths in the module services are written WITHOUT the /api/v1 prefix
 * ("auth/login", "workspace/screens"); the proxy adds it. The full list of backend
 * endpoints, payloads and responses is in backend/docs/API_REFERENCE.txt.
 *
 * Environment
 * -----------
 *   EDUNEXA_API_URL   Backend origin used by the server-side proxy (never sent to the browser).
 *                     Default http://185.193.19.156:8010 (the deployed backend);
 *                     set EDUNEXA_API_URL=http://127.0.0.1:8010 in .env.local to use a local backend.
 */

/** Origin of the FastAPI backend, read on the server only (proxy route). */
const backendUrl = (
  process.env.EDUNEXA_API_URL || "http://185.193.19.156:8010"
).replace(/\/+$/, "");

export const API_CONFIG = {
  /** Same-origin path every browser request goes to; the proxy forwards it. */
  proxyBaseUrl: "/api/college",
  /** Backend origin (server side only). */
  backendUrl,
  /** Version prefix of every backend route. */
  backendPrefix: "/api/v1",
  /** Client identifier the backend issues admin-portal sessions for. */
  client: "admin-web",
  /** Upstream timeout used by the proxy, in milliseconds. */
  upstreamTimeoutMs: 25_000,
  /** Largest request body the proxy forwards (bytes); matches the backend's 1 MB JSON limit. */
  maxBodyBytes: 1_048_576,
  /** Paths the proxy forwards without a session (public site and sign-in page). */
  publicPaths: [
    "public/options",
    "public/applications",
    "public/contact",
    "auth/roles",
  ],
  /** Public path prefixes (certificate verification links). */
  publicPrefixes: ["documents/certificates/verify/"],
  /** httpOnly cookies the proxy keeps the tokens in. */
  cookies: {
    access: "edu_access",
    refresh: "edu_refresh",
    path: "/api/college",
    refreshMaxAgeSeconds: 7 * 86_400,
  },
  /** Default page size of list endpoints (backend default 50, maximum 200). */
  pageSize: 50,
} as const;

/** Browser URL for an API path, e.g. apiUrl("auth/me") -> "/api/college/auth/me". */
export function apiUrl(path: string): string {
  return `${API_CONFIG.proxyBaseUrl}/${stripPrefix(path)}`;
}

/** Backend URL for an API path (proxy route only). */
export function backendApiUrl(path: string): string {
  return `${API_CONFIG.backendUrl}${API_CONFIG.backendPrefix}/${stripPrefix(path)}`;
}

/**
 * Screen contracts return full backend paths ("/api/v1/academics/students"); module services
 * use relative ones ("academics/students"). Both are accepted everywhere.
 */
export function stripPrefix(path: string): string {
  return path
    .replace(new RegExp(`^${API_CONFIG.backendPrefix}/`), "")
    .replace(/^\/+/, "");
}
