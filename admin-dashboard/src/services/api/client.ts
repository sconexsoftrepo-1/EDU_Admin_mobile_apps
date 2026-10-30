/**
 * HTTP client for browser components. Every module service calls the backend through
 * apiRequest/apiDownload; the base URL comes from config.ts.
 */
import { apiUrl } from "./config";
import { HTTP_STATUS, type ApiErrorBody, type HttpMethod } from "./consts";
import { invalidateWorkspaceDataCache } from "@/lib/colleges/workspace-cache";

/** Failed API call: `status` is the HTTP status, `message` the backend's detail text. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type Query = Record<
  string,
  string | number | boolean | null | undefined
>;

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

/** "?a=1&b=x" for the defined values of `query`, or "". */
export function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value));
  const text = params.toString();
  return text ? "?" + text : "";
}

function errorMessage(body: ApiErrorBody | undefined, status: number) {
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((issue) => {
      if (!issue || typeof issue !== "object" || typeof issue.msg !== "string")
        return [];
      const field = Array.isArray(issue.loc)
        ? issue.loc
            .filter(
              (part: unknown) =>
                typeof part === "string" &&
                !["body", "query", "path"].includes(part),
            )
            .join(".")
            .replaceAll("_", " ")
        : "";
      return [field ? `${field}: ${issue.msg}` : issue.msg];
    });
    if (messages.length) return messages.join("; ");
  }
  if (detail !== undefined) return JSON.stringify(detail);
  return `Request failed (${status})`;
}

/** JSON request; resolves with the parsed body ({} for 204) or throws ApiError. */
export async function apiRequest<T = unknown>(
  path: string,
  { method = "GET", body, query, signal }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(apiUrl(path) + buildQuery(query), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  const value =
    response.status === HTTP_STATUS.noContent
      ? {}
      : await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      response.status,
      errorMessage(value, response.status),
      value,
    );
  if (method !== "GET" && !path.startsWith("auth/"))
    invalidateWorkspaceDataCache();
  return value as T;
}

/** Binary download (PDF, CSV) saved in the browser as `filename`. */
export async function apiDownload(
  path: string,
  filename: string,
): Promise<void> {
  const response = await fetch(apiUrl(path), { cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new ApiError(
      response.status,
      errorMessage(body, response.status),
      body,
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Base64 content of a browser File, as upload endpoints expect it. */
export async function fileToBase64(file: File): Promise<string> {
  let raw = "";
  new Uint8Array(await file.arrayBuffer()).forEach(
    (b) => (raw += String.fromCharCode(b)),
  );
  return btoa(raw);
}

/** Message to show for a failed call (the backend's detail for API errors). */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
