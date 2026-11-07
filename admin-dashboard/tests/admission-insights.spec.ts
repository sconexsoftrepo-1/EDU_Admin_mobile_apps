import { expect, test, type Page } from "@playwright/test";

const origin = process.env.EDUNEXA_TEST_BASE_URL;
const shots = process.env.EDUNEXA_TEST_SHOTS;
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");

const summary = (total: number, joined: number) => ({
  total,
  joined,
  conversion: total ? Math.round((joined * 1000) / total) / 10 : 0,
  in_progress: total - joined,
  not_interested: 0,
  statuses: [
    { name: "joined", count: joined, percentage: 25 },
    { name: "not_interested", count: total - joined, percentage: 75 },
  ],
  courses: [{ name: "BCA", count: total, percentage: 100 }],
  referrers: [{ name: "Rohan Varma", count: total, percentage: 100 }],
});
const row = (code: string, name: string, type: string, label: string) => ({
  code,
  name,
  course_name: "BCA",
  reference_type: type,
  reference_label: label,
  reference_name: type === "staff" ? "Rohan Varma" : "Instagram",
  status: "new",
  recorded_at: null,
});
const insights = {
  available: [
    {
      program_code: "BCA",
      course_name: "BCA",
      course_level: "degree",
      intake_capacity: 60,
      joined: 1,
      cycle_name: "2026 intake",
      academic_year: "2026-27",
      closes_on: "2026-12-31",
    },
    {
      program_code: "MPC",
      course_name: "MPC",
      course_level: "intermediate",
      intake_capacity: 40,
      joined: 0,
      cycle_name: null,
      academic_year: null,
      closes_on: null,
    },
  ],
  analytics: {
    can_view_all: true,
    all: {
      ...summary(4, 1),
      by_reference: [
        { key: "staff", label: "Staff reference", share: 75, ...summary(3, 1) },
        { key: "social_media", label: "Social media", share: 25, ...summary(1, 0) },
      ],
    },
    mine: {
      ...summary(1, 0),
      by_reference: [
        { key: "staff", label: "Staff reference", share: 100, ...summary(1, 0) },
      ],
    },
    all_rows: [
      row("E1", "Asha Rao", "staff", "Staff reference"),
      row("E2", "Ravi Kumar", "social_media", "Social media"),
    ],
    my_rows: [row("E1", "Asha Rao", "staff", "Staff reference")],
  },
};

async function signIn(page: Page, session: { code: string }) {
  await page.route("**/api/college/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/admissions/insights"))
      return route.fulfill({ json: insights });
    if (path.endsWith("/auth/me"))
      return route.fulfill({
        json: {
          account: {
            code: "ADMIN",
            login_id: "admin",
            active: true,
            role_codes: ["SYSTEM-ADMIN"],
            clients: ["admin-web"],
            person_type: "employee",
            person_code: "ADMIN-EMP",
            login_code: session.code,
            workspace_scope: "college",
          },
          roles: [
            {
              code: "SYSTEM-ADMIN",
              name: "Super Admin",
              scope: "college",
              system_admin: true,
              permissions: {},
            },
          ],
        },
      });
    return route.fulfill({ status: 503, json: { detail: "Not mocked" } });
  });
  await page.goto(`${origin}/portal/admin`);
}

test("admissions popup, side nav and reference analytics", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1366, height: 900 });
  const session = { code: "LOGIN-1" };
  await signIn(page, session);

  const popup = page.getByRole("dialog", { name: "Admissions open" });
  await expect(popup).toBeVisible({ timeout: 60_000 });
  await expect(popup.getByText("2 courses available")).toBeVisible();
  await expect(popup.getByText("60 seats")).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/popup.png` });
  await popup.getByRole("button", { name: "Close", exact: true }).click();
  await expect(popup).toBeHidden();

  // A top-level side nav item, above the module groups.
  const nav = page.getByRole("navigation", { name: "Portal navigation" });
  const links = nav.getByRole("link");
  await expect(nav.getByRole("link", { name: "Admissions", exact: true })).toHaveCount(1);
  const names = await links.allInnerTexts();
  expect(names.map((n) => n.trim()).indexOf("Admissions")).toBeLessThan(
    names.map((n) => n.trim()).indexOf("Academics"),
  );

  // Same login: no second popup after a reload. A new login shows it again.
  await page.reload();
  await expect(nav.getByRole("link", { name: "Admissions", exact: true })).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await expect(popup).toBeHidden();
  session.code = "LOGIN-2";
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(popup).toBeVisible({ timeout: 60_000 });

  await page.setViewportSize({ width: 390, height: 780 });
  if (shots) await page.screenshot({ path: `${shots}/popup-phone.png` });
});
