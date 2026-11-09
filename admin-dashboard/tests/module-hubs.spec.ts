import { expect, test, type Page } from "@playwright/test";
import definitions from "../src/lib/colleges/module-hubs.json";
import { SCREEN_CATALOG } from "../src/services/api/modules/workspace/catalog";
import { activeHub, visibleHubs } from "../src/lib/colleges/module-hubs";
import { collegeBySlug, validCollegePath } from "../src/data/colleges";
const origin = process.env.EDUNEXA_TEST_BASE_URL;
const finance = definitions.find((h) => h.key === "finance")!;
const summary = (key: string) => ({
  key,
  today: "2026-11-07",
  metrics: [
    {
      label: "Total collected",
      value: "1680000",
      kind: "money",
      hint: "Settled collections",
      module: "payments",
      trend: null,
    },
    {
      label: "Outstanding fees",
      value: "2123000",
      kind: "money",
      hint: "Current ledger",
      module: "fees",
      trend: null,
    },
  ],
  charts: [
    {
      title: "Monthly collection trend",
      kind: "money",
      items: [
        { label: "2026-10", value: 120000 },
        { label: "2026-11", value: 80000 },
      ],
    },
  ],
  cashbook: { opening: 50000, receipts: 10000, payments: 2000, closing: 58000 },
  recent: [],
  pending: [],
  pending_count: 0,
  years: [{ code: "Y", name: "2026–27" }],
  destinations: definitions.find((h) => h.key === key)!.screens,
});
async function setup(page: Page, limited = false) {
  const requests: string[] = [];
  await page.route("**/api/college/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          account: {
            code: "TEST",
            login_id: "test",
            active: true,
            role_codes: ["ROOT"],
            clients: ["admin-web"],
            person_type: "system",
            login_code: "L",
            workspace_scope: "college",
          },
          roles: [
            {
              code: "ROOT",
              name: "Super Admin",
              scope: "college",
              system_admin: !limited,
              permissions: limited ? { payments: ["view"] } : {},
              ...(limited ? { screens: ["payments"] } : {}),
            },
          ],
        },
      });
    if (path.endsWith("/chat/unread"))
      return route.fulfill({ json: { count: 0 } });
    if (path.endsWith("/edit-requests/pending-count"))
      return route.fulfill({ json: { count: 0 } });
    if (path.endsWith("/admissions/insights"))
      return route.fulfill({
        json: { open_courses: [], mine: [], can_view_all: false },
      });
    if (path.includes("/dashboard/modules/"))
      return route.fulfill({ json: summary(path.split("/").at(-1)!) });
    if (path.endsWith("/dashboard/overview"))
      return route.fulfill({
        json: {
          viewer: {
            name: "Test",
            roles: ["Super Admin"],
            campus: "Main campus",
          },
          academic_session: "2026–27",
          today: "2026-11-07",
          sections: {},
        },
      });
    return route.fulfill({
      status: 503,
      json: { detail: "Unexpected request" },
    });
  });
  return requests;
}
test("every hub has a valid URL and preserves permission-filtered deep links", () => {
  const allowed = SCREEN_CATALOG.map((s) => s.key);
  for (const hub of visibleHubs(allowed)) {
    expect(
      validCollegePath(collegeBySlug("edunexa-college")!, [
        "portal",
        "admin",
        `hub-${hub.key}`,
      ]),
    ).toBe(true);
    expect(activeHub(`hub-${hub.key}`, allowed)?.screens).toEqual(hub.screens);
    for (const screen of hub.screens) expect(allowed).toContain(screen);
  }
  expect(visibleHubs(["payments"]).map((h) => h.key)).toEqual(["finance"]);
  expect(activeHub("hub-administration", ["payments"])).toBeUndefined();
});
test("finance hub displays server values and preserves workspace destinations", async ({
  page,
}) => {
  test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend");
  const requests = await setup(page);
  await page.goto(`${origin}/portal/admin/hub-finance`);
  await expect(
    page.getByRole("heading", { name: "Finance & Fees", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mhub-kpis")).toContainText("₹16,80,000");
  await expect(page.locator(".mhub-links a")).toHaveCount(
    finance.screens.length,
  );
  await expect(
    page.locator('.mhub-links a[href="/portal/admin/payments"]'),
  ).toBeVisible();
  expect(
    requests.filter(
      (p) =>
        p.includes("/workspace/resources/") ||
        p.includes("/finance/payments") ||
        p.includes("/academics/students"),
    ),
  ).toEqual([]);
  await page.getByRole("textbox", { name: "Find a workspace" }).fill("scholar");
  await expect(page.locator(".mhub-links a")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Find a workspace" }).fill("");
  await page.getByLabel("From", { exact: true }).fill("2026-12-01");
  await page.getByLabel("To", { exact: true }).fill("2026-01-01");
  await expect(page.locator(".mhub [role=alert]")).toContainText(
    "From date must be on or before To date",
  );
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.locator(".mhub-kpis")).toBeVisible();
  for (const width of [1920, 1440, 1280, 1024, 768, 430, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `Overflow at ${width}px`,
    ).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "/tmp/pragathi-module-finance.png",
    fullPage: true,
  });
});
test("sidebar opens each permitted hub and keeps active module on history navigation", async ({
  page,
}) => {
  test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend");
  await setup(page);
  await page.goto(`${origin}/portal/admin/hub-finance`);
  await page.locator(".mhub-kpis").waitFor();
  for (const hub of visibleHubs(SCREEN_CATALOG.map((s) => s.key))) {
    await page
      .locator(`.erp-hub-navigation a[href="/portal/admin/hub-${hub.key}"]`)
      .click();
    await expect(
      page.getByRole("heading", { name: hub.title, exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(
        `.erp-hub-navigation a[href="/portal/admin/hub-${hub.key}"]`,
      ),
    ).toHaveAttribute("aria-current", "page");
  }
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Library", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Library", exact: true }),
  ).toBeVisible();
});
test("failed summary offers retry, never renders false zero metrics", async ({
  page,
}) => {
  test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend");
  await setup(page);
  await page.route("**/dashboard/modules/finance*", (route) =>
    route.fulfill({ status: 503, json: { detail: "Temporarily unavailable" } }),
  );
  await page.goto(`${origin}/portal/admin/hub-finance`);
  await expect(page.locator(".mhub [role=alert]")).toContainText(
    "Temporarily unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mhub-kpis")).toHaveCount(0);
  await expect(page.locator(".mhub-links a")).toHaveCount(
    finance.screens.length,
  );
});

test("sidebar collapse persists and mobile navigation supports Escape", async ({ page }) => {
  test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend");
  await setup(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/portal/admin/hub-finance`);
  await page.locator(".mhub-kpis").waitFor();
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await expect(page.locator(".college-erp")).toHaveClass(/erp-compact/);
  await page.reload();
  await page.locator(".mhub-kpis").waitFor();
  await expect(page.locator(".college-erp")).toHaveClass(/erp-compact/);
  const academic = page.locator('.erp-hub-navigation a[href="/portal/admin/hub-academics"]');
  await academic.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Academics", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open portal navigation", exact: true }).click();
  await expect(page.locator(".erp-sidebar")).toHaveClass(/is-open/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".erp-sidebar")).not.toHaveClass(/is-open/);
  await expect(page.getByRole("button", { name: "Open portal navigation", exact: true })).toBeFocused();
});

test("restricted role sees only its authorized module and workspace cards", async ({ page }) => {
  test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend");
  await setup(page, true);
  await page.goto(`${origin}/portal/admin/hub-finance`);
  await expect(page.getByRole("heading", { name: "Finance & Fees", exact: true })).toBeVisible();
  await expect(page.locator(".mhub-links a")).toHaveCount(1);
  await expect(page.locator('.mhub-links a[href="/portal/admin/payments"]')).toBeVisible();
  await expect(page.locator('.erp-hub-navigation a[href="/portal/admin/hub-administration"]')).toHaveCount(0);
  await expect(page.locator('.erp-hub-navigation a[href="/portal/admin/hub-students"]')).toHaveCount(0);
});
