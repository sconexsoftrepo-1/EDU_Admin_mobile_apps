import { expect, test, type Page } from "@playwright/test";

const origin = process.env.EDUNEXA_TEST_BASE_URL;
const root = "/portal/admin";
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running dashboard");

async function setup(page: Page) {
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
            code: "CONTROLS-ADMIN",
            login_id: "admin",
            person_type: "system",
            clients: ["admin-web"],
            role_codes: [role.code],
          },
          roles: [role],
        },
      });
    if (path.startsWith("workspace/screens/"))
      return route.fulfill({
        json: {
          key: path.split("/").at(-1),
          title: "College records",
          resources: [],
        },
      });
    if (path === "academics/timetable-templates/options")
      return route.fulfill({ json: { courses: [], batches: [] } });
    if (path === "academics/timetable-templates")
      return route.fulfill({
        json: { items: [], can_create: true, can_edit: true },
      });
    if (path.startsWith("workspace/lookups/"))
      return route.fulfill({ json: [] });
    return route.fulfill({
      json: {
        items: [],
        total: 0,
        actions: [],
        roles: [],
        screens: [],
        summary: {},
      },
    });
  });
}

for (const [screen, title] of [
  ["campaigns", "Notification campaigns"],
  ["notifications", "Notifications"],
  ["employees", "Employee directory"],
]) {
  test(`${title} shows one working record-management control`, async ({
    page,
  }) => {
    await setup(page);
    await page.goto(`${origin}${root}/${screen}`);
    const manage = page.getByRole("button", {
      name: `Manage ${title}`,
      exact: true,
    });
    await expect(manage).toHaveCount(1);
    await expect(page.locator(".erp-api-controls")).toHaveCount(1);
    await manage.click();
    await expect(
      page.getByRole("dialog", { name: "Manage college records", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close record management", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Manage college records", exact: true }),
    ).toHaveCount(0);
  });
}

test("Students keeps only its inline Manage action", async ({ page }) => {
  await setup(page);
  await page.goto(`${origin}${root}/students`);
  await expect(
    page.getByRole("button", { name: "Manage Students", exact: true }),
  ).toHaveCount(1);
  await expect(page.locator(".erp-api-controls")).toHaveCount(0);
});

test("the timetable studio does not get a generic record-management bar", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`${origin}${root}/timetable`);
  await expect(
    page.getByRole("heading", { name: "Timetable studio", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".erp-api-controls")).toHaveCount(0);
});
