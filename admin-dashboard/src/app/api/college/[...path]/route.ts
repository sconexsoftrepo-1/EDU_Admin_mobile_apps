import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
export const runtime = "nodejs";
import { API_CONFIG, backendApiUrl } from "@/services/api/config";
// Backend origin, timeouts, cookie names and public paths: src/services/api/config.ts.
const { cookies } = API_CONFIG;
const activeRefresh = new Map<string, Promise<Record<string, unknown>>>();
function clear(response: NextResponse) {
  response.cookies.set(cookies.access, "", {
    path: cookies.path,
    maxAge: 0,
    httpOnly: true,
  });
  response.cookies.set(cookies.refresh, "", {
    path: cookies.path,
    maxAge: 0,
    httpOnly: true,
  });
  return response;
}
function tokens(
  response: NextResponse,
  pair: Record<string, unknown>,
  request: NextRequest,
) {
  const secure =
    request.nextUrl.protocol === "https:" ||
    process.env.NODE_ENV === "production";
  const options = {
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    path: cookies.path,
  };
  response.cookies.set(cookies.access, String(pair.access_token), {
    ...options,
    maxAge: Number(pair.expires_in) || 600,
  });
  response.cookies.set(cookies.refresh, String(pair.refresh_token), {
    ...options,
    maxAge: cookies.refreshMaxAgeSeconds,
  });
}
async function upstream(
  path: string,
  method: string,
  body: string | undefined,
  access?: string,
) {
  return fetch(backendApiUrl(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(API_CONFIG.upstreamTimeoutMs),
  });
}
async function rotate(token: string) {
  const key = createHash("sha256").update(token).digest("hex");
  let task = activeRefresh.get(key);
  if (!task) {
    task = (async () => {
      const response = await upstream(
        "auth/refresh",
        "POST",
        JSON.stringify({ refresh_token: token, client: API_CONFIG.client }),
      );
      if (!response.ok) throw Error("Session expired");
      return response.json();
    })();
    activeRefresh.set(key, task);
    // Reuse the same rotation for requests already in flight with the old cookie.
    // Their upstream 401 can arrive up to the upstream timeout after rotation.
    void task
      .finally(() =>
        setTimeout(
          () => activeRefresh.delete(key),
          API_CONFIG.upstreamTimeoutMs + 5000,
        ),
      )
      .catch(() => {});
  }
  return task;
}
/**
 * Writes must come from this site. Compare the Origin header with the Host the browser used:
 * with `next dev --hostname 0.0.0.0`, request.nextUrl.origin is http://0.0.0.0:3000 even when
 * the page is open on localhost.
 */
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host =
      request.headers.get("x-forwarded-host") || request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await context.params;
  if (parts.some((part) => !/^[-a-zA-Z0-9_.]+$/.test(part) || part === ".."))
    return NextResponse.json({ detail: "Invalid path" }, { status: 400 });
  const path = parts.join("/");
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request))
    return NextResponse.json(
      { detail: "Same-origin request required" },
      { status: 403 },
    );
  try {
    let body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.text();
    if (body && Buffer.byteLength(body) > API_CONFIG.maxBodyBytes)
      return NextResponse.json(
        { detail: "Request too large" },
        { status: 413 },
      );
    if (
      API_CONFIG.publicPrefixes.some((prefix) => path.startsWith(prefix)) &&
      request.method === "GET"
    ) {
      const result = await upstream(path, "GET", undefined);
      return new NextResponse(await result.arrayBuffer(), {
        status: result.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if ((API_CONFIG.publicPaths as readonly string[]).includes(path)) {
      const result = await upstream(path, request.method, body);
      return new NextResponse(await result.arrayBuffer(), {
        status: result.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    let access = request.cookies.get(cookies.access)?.value;
    const refresh = request.cookies.get(cookies.refresh)?.value;
    let pair: Record<string, unknown> | undefined;
    if (path === "auth/login") {
      const parsed = JSON.parse(body || "{}");
      body = JSON.stringify({ ...parsed, client: API_CONFIG.client });
      const result = await upstream(path, "POST", body);
      const payload = await result.json();
      if (!result.ok)
        return NextResponse.json(payload, {
          status: result.status,
          headers: {
            "Cache-Control": "no-store",
            ...(result.headers.has("retry-after")
              ? { "Retry-After": result.headers.get("retry-after")! }
              : {}),
          },
        });
      // Tokens stay in httpOnly cookies; the page gets the account and its roles (navigation).
      const response = NextResponse.json({
        account: payload.account,
        roles: payload.roles,
      });
      tokens(response, payload, request);
      return response;
    }
    if (!access && refresh) {
      try {
        pair = await rotate(refresh);
        access = String(pair.access_token);
      } catch {
        return clear(
          NextResponse.json(
            { detail: "Please sign in again" },
            { status: 401 },
          ),
        );
      }
    }
    if (!access)
      return clear(
        NextResponse.json({ detail: "Please sign in" }, { status: 401 }),
      );
    let result = await upstream(
      path + request.nextUrl.search,
      request.method,
      body,
      access,
    );
    if (result.status === 401 && refresh) {
      try {
        pair = await rotate(refresh);
        result = await upstream(
          path + request.nextUrl.search,
          request.method,
          body,
          String(pair.access_token),
        );
      } catch {
        return clear(
          NextResponse.json({ detail: "Session expired" }, { status: 401 }),
        );
      }
    }
    const response = new NextResponse(
      result.status === 204 ? null : await result.arrayBuffer(),
      {
        status: result.status,
        headers: {
          "Content-Type":
            result.headers.get("content-type") || "application/json",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          ...(result.headers.has("content-disposition")
            ? {
                "Content-Disposition": result.headers.get(
                  "content-disposition",
                )!,
              }
            : {}),
        },
      },
    );
    if (
      path === "auth/logout" ||
      path === "auth/logout-all" ||
      path === "auth/change-password" ||
      result.status === 401
    )
      return clear(response);
    if (pair) tokens(response, pair, request);
    return response;
  } catch (error) {
    const timeout =
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name);
    console.error(
      `EduNexa upstream request failed: ${path} (${error instanceof Error ? error.name : "unknown"})`,
    );
    return NextResponse.json(
      {
        detail: timeout
          ? `The college API timed out while loading ${path}. Please retry.`
          : `The college API could not complete ${path}. Please retry.`,
      },
      { status: 503 },
    );
  }
}
export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as PUT,
  proxy as DELETE,
};
