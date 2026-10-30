import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/college/[...path]/route";

const pair = {
  access_token: "renewed-access",
  refresh_token: "renewed-refresh-token",
  expires_in: 600,
};
const routeContext = {
  params: Promise.resolve({ path: ["workspace", "screens", "dashboard"] }),
};
function request(refresh: string, access?: string) {
  return new NextRequest(
    "http://localhost:3000/api/college/workspace/screens/dashboard",
    {
      headers: {
        cookie: `edu_refresh=${refresh}${access ? `; edu_access=${access}` : ""}`,
      },
    },
  );
}

test("expired access renews once for concurrent screen requests", async () => {
  const previous = globalThis.fetch;
  let rotations = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("auth/refresh")) {
      rotations++;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return Response.json(pair);
    }
    return new Headers(init?.headers).get("authorization") ===
      "Bearer renewed-access"
      ? Response.json({ resources: [] })
      : Response.json({ detail: "Access expired" }, { status: 401 });
  };
  try {
    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        GET(request("parallel-renewal-token", "expired-access"), routeContext),
      ),
    );
    expect(rotations).toBe(1);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.cookies.get("edu_refresh")?.value).toBe(
        pair.refresh_token,
      );
    }
  } finally {
    globalThis.fetch = previous;
  }
});

test("temporary refresh failure preserves cookies and is retried on the next request", async () => {
  const previous = globalThis.fetch;
  let rotations = 0;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("auth/refresh")) {
      rotations++;
      return rotations === 1
        ? Response.json({ detail: "Temporarily unavailable" }, { status: 503 })
        : Response.json(pair);
    }
    return Response.json({ resources: [] });
  };
  try {
    const failed = await GET(request("temporary-failure-token"), routeContext);
    expect(failed.status).toBe(503);
    expect(failed.cookies.getAll()).toHaveLength(0);
    const recovered = await GET(
      request("temporary-failure-token"),
      routeContext,
    );
    expect(recovered.status).toBe(200);
    expect(rotations).toBe(2);
    expect(recovered.cookies.get("edu_refresh")?.value).toBe(
      pair.refresh_token,
    );
  } finally {
    globalThis.fetch = previous;
  }
});

test("successful rotation keeps its cookies when a later resource request loses connection", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("auth/refresh")) return Response.json(pair);
    throw new TypeError("Connection interrupted");
  };
  try {
    const result = await GET(
      request("post-rotation-network-failure"),
      routeContext,
    );
    expect(result.status).toBe(503);
    expect(result.cookies.get("edu_access")?.value).toBe(pair.access_token);
    expect(result.cookies.get("edu_refresh")?.value).toBe(pair.refresh_token);
  } finally {
    globalThis.fetch = previous;
  }
});

test("a rejected refresh token clears the session", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ detail: "Revoked refresh token" }, { status: 401 });
  try {
    const result = await GET(request("revoked-refresh-token"), routeContext);
    expect(result.status).toBe(401);
    expect(result.cookies.get("edu_access")?.maxAge).toBe(0);
    expect(result.cookies.get("edu_refresh")?.maxAge).toBe(0);
  } finally {
    globalThis.fetch = previous;
  }
});

test("idle sessions renew when the browser access cookie has expired", async () => {
  const previous = globalThis.fetch;
  let rotations = 0;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("auth/refresh")) {
      rotations++;
      return Response.json(pair);
    }
    return Response.json({ resources: [] });
  };
  try {
    const result = await GET(
      request("idle-session-refresh-token"),
      routeContext,
    );
    expect(result.status).toBe(200);
    expect(rotations).toBe(1);
    expect(result.cookies.get("edu_refresh")?.maxAge).toBe(7 * 86400);
  } finally {
    globalThis.fetch = previous;
  }
});
