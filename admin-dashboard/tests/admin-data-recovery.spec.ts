import { expect, test } from "@playwright/test";
import { loadTemplateState } from "../src/lib/colleges/template-api";

const summary = {
  key: "dashboard",
  title: "Dashboard",
  resources: ["employees"],
};
const descriptor = {
  ...summary,
  resources: [
    {
      name: "employees",
      title: "Employees",
      path: "human-resources/employees",
      fields: [],
      actions: ["view"],
    },
  ],
};

test("dashboard retries interrupted screen and record reads without losing Super Admin data", async () => {
  const previous = globalThis.fetch;
  const counts = new Map<string, number>();
  globalThis.fetch = async (input) => {
    const path = new URL(String(input), "http://localhost").pathname;
    const count = (counts.get(path) || 0) + 1;
    counts.set(path, count);
    if (count === 1)
      return Response.json({ detail: "API restarting" }, { status: 503 });
    return Response.json(
      path.includes("workspace/screens")
        ? descriptor
        : {
            items: [
              { code: "EMP-1", first_name: "Test", last_name: "Employee" },
            ],
            total: 1,
          },
    );
  };
  try {
    const result = await loadTemplateState(
      "edunexa-college",
      [summary],
      "dashboard",
    );
    expect(result.errors).toEqual([]);
    expect(result.state.staff).toHaveLength(1);
    expect([...counts.values()]).toEqual([2, 2]);
  } finally {
    globalThis.fetch = previous;
  }
});

test("dashboard permission denials are not retried or bypassed", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ detail: "Screen access denied" }, { status: 403 });
  };
  try {
    const result = await loadTemplateState(
      "edunexa-college",
      [summary],
      "dashboard",
    );
    expect(result.errors).toEqual(["Dashboard"]);
    expect(calls).toBe(1);
  } finally {
    globalThis.fetch = previous;
  }
});

test("a genuinely expired session propagates once instead of becoming screen loading warnings", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ detail: "Please sign in again" }, { status: 401 });
  try {
    await expect(
      loadTemplateState("edunexa-college", [summary], "dashboard"),
    ).rejects.toMatchObject({ status: 401 });
  } finally {
    globalThis.fetch = previous;
  }
});

test("Super Admin can reload failed dashboard requests without signing out", async ({
  page,
}) => {
  const origin = process.env.EDUNEXA_TEST_BASE_URL;
  test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running dashboard");
  let healthy = false;
  const role = {
    code: "ROOT",
    name: "Super Admin",
    system_admin: true,
    scope: "college",
    permissions: {},
  };
  await page.route("**/api/college/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/api/college/",
    )[1];
    if (path === "auth/me")
      return route.fulfill({
        json: {
          account: {
            code: "RECOVERY-ADMIN",
            login_id: "admin",
            person_type: "system",
            role_codes: [role.code],
            clients: ["admin-web"],
          },
          roles: [role],
        },
      });
    if (path.startsWith("workspace/screens/")) {
      if (!healthy)
        return route.fulfill({
          status: 503,
          json: { detail: "API restarting" },
        });
      const key = path.split("/").at(-1);
      return route.fulfill({ json: { key, title: key, resources: [] } });
    }
    return route.fulfill({
      json: {
        items: [],
        total: 0,
        roles: [],
        screens: [],
        summary: {},
        actions: [],
      },
    });
  });
  await page.goto(
    `${origin}/portal/admin/dashboard`,
  );
  const warning = page.locator(".erp-record-recovery");
  await expect(warning).toContainText("Some data requests failed");
  healthy = true;
  await page
    .getByRole("button", { name: "Reload records", exact: true })
    .click();
  await expect(warning).toHaveCount(0);
  await expect(page).toHaveURL(/portal\/admin\/dashboard$/);
});
