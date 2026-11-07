import { expect, test, type Page } from "@playwright/test";

const origin = process.env.EDUNEXA_TEST_BASE_URL;
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");

const metric = (label: string, value: unknown, kind = "number", module = "students") => ({
  label, value, kind, hint: null, module, trend: null,
});
const overview = {
  viewer: { name: "Ravi Teja", login_id: "ravi", roles: ["Accounts Manager"], campus: "Main Campus" },
  academic_session: "2026-27",
  today: "2026-11-07",
  sections: {
    finance: {
      metrics: {
        fee_collection: metric("Fee collection", "1680000.00", "money", "payments"),
        outstanding_fees: metric("Outstanding fees", "2123000.00", "money", "fees"),
        today_collection: metric("Today's collection", "0", "money", "payments"),
      },
      monthly: [{ month: "2026-10", collected: 240000, outstanding: 0 }],
    },
    counts: { metrics: { expenses: metric("Recorded expenses", "79853.00", "money", "expenses") } },
    students: { error: true },
  },
};

async function open(page: Page, role: Record<string, unknown>, body: unknown = overview) {
  await page.route("**/api/college/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/dashboard/overview")) return route.fulfill({ json: body });
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          account: { code: "U", login_id: "u", active: true, role_codes: [role.code], clients: ["admin-web"],
            person_type: "employee", person_code: "E", login_code: "L1", workspace_scope: "college" },
          roles: [role],
        },
      });
    return route.fulfill({ status: 503, json: { detail: "Not mocked" } });
  });
  await page.goto(`${origin}/portal/accounts/dashboard`);
}
const accounts = { code: "A", name: "Accounts Manager", scope: "college",
  permissions: { payments: ["view"], student_fee_charges: ["view"], reports: ["view"] } };

test("greets the person, shows rupees and picks the role's cards", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, accounts);
  await expect(page.getByRole("heading", { name: "Welcome back, Ravi Teja!" })).toBeVisible({ timeout: 60_000 });
  const kpis = page.locator(".dov-kpi");
  await expect(kpis).toHaveCount(4);
  // Rupees from the API: not divided by 100, and in Indian digit grouping.
  await expect(kpis.nth(0)).toContainText("₹16,80,000");
  await expect(kpis.nth(1)).toContainText("₹21,23,000");
  await expect(kpis.nth(2)).toContainText("Today's collection");
  await expect(kpis.nth(3)).toContainText("Recorded expenses");
  // A failed section offers a retry and is not shown as zero.
  await expect(page.getByText("This section could not be loaded.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Admission funnel" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Fee collection (monthly)" })).toBeVisible();
});

test("no horizontal page scroll at any width", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, accounts);
  await page.locator(".dov-kpi").first().waitFor({ timeout: 60_000 });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(250);
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scroll, `at ${width}px`).toBeLessThanOrEqual(width);
  }
});
