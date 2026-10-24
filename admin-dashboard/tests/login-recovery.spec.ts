import { expect, test, type Page } from "@playwright/test";
const origin = process.env.EDUNEXA_TEST_BASE_URL;
const root = "/colleges-institutions/edunexa-college";
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");
test.setTimeout(60_000);
const admin = {
  code: "SYSTEM-ADMIN",
  name: "Super Admin",
  scope: "college",
  system_admin: true,
  permissions: {},
};
const master = {
  code: "MASTER-DATA-ENTRY",
  name: "Master Data Entry",
  scope: "college",
  permissions: { students: ["view"] },
  screens: ["student-enrollment"],
};
const account = {
  code: "VERIFY-USER",
  login_id: "college-user",
  active: true,
  person_type: "system",
  person_code: "verification",
  role_codes: [admin.code],
  clients: ["admin-web"],
  workspace_scope: "college",
  session_code: "verification-session",
};
async function mockApi(
  page: Page,
  options: { status?: number; roles?: object[]; signedIn?: boolean } = {},
) {
  let signedIn = options.signedIn || false;
  const roles = options.roles || [admin];
  await page.route("**/api/college/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/api/college/",
    )[1];
    if (path === "auth/roles")
      return route.fulfill({ json: { roles: [admin, master] } });
    if (path === "auth/me")
      return route.fulfill(
        signedIn
          ? { json: { account, roles } }
          : { status: 401, json: { detail: "Please sign in" } },
      );
    if (path === "auth/login") {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const status = options.status || 200;
      if (status >= 400)
        return route.fulfill({
          status,
          json: { detail: "Invalid credentials or role" },
        });
      signedIn = true;
      return route.fulfill({ json: { account, roles } });
    }
    if (
      ["admin/roles", "admin/accounts", "admin/forms", "forms"].includes(path)
    )
      return route.fulfill({ json: [] });
    return route.fulfill({
      json: { items: [], total: 0, actions: [], screens: [], summary: {} },
    });
  });
}
async function fillLogin(page: Page) {
  await page.goto(`${origin}${root}/portal/login`);
  await expect(page.getByRole("combobox", { name: "Role" })).toBeEnabled();
  await page.getByLabel("Login ID", { exact: true }).fill("college-user");
  await page.locator('input[name="password"]').fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
for (const status of [401, 403]) {
  test(`login ${status} stays inline and preserves entered details`, async ({
    page,
  }) => {
    await mockApi(page, { status });
    await fillLogin(page);
    await expect(page.locator("#sign-in-error")).toContainText(
      status === 401 ? "Login ID or password is incorrect" : "selected role",
    );
    await expect(page.getByLabel("Login ID", { exact: true })).toHaveValue(
      "college-user",
    );
    await expect(page.locator('input[name="password"]')).toHaveValue(
      "wrong-password",
    );
    await expect(
      page.getByRole("heading", { name: "Access denied", exact: true }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(`${origin}${root}/portal/login`);
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeEnabled();
  });
}
test("an unassigned selected role stays on the login form", async ({
  page,
}) => {
  await mockApi(page, { roles: [master] });
  await fillLogin(page);
  await expect(page.locator("#sign-in-error")).toContainText(
    "not assigned to the selected role",
  );
  await expect(page).toHaveURL(`${origin}${root}/portal/login`);
});
test("a role without workspace permissions shows an inline access error", async ({
  page,
}) => {
  await mockApi(page, { roles: [{ ...admin, system_admin: false }] });
  await fillLogin(page);
  await expect(page.locator("#sign-in-error")).toContainText(
    "no workspace access",
  );
  await expect(
    page.getByRole("heading", { name: "Access denied", exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(`${origin}${root}/portal/login`);
});
test("a valid login still enters the assigned dashboard", async ({ page }) => {
  await mockApi(page);
  await fillLogin(page);
  await expect(page).toHaveURL(new RegExp(`${root}/portal/admin/dashboard$`));
});
test("an unavailable workspace opens sign-in with an inline access message", async ({
  page,
}) => {
  await mockApi(page, { signedIn: true, roles: [master] });
  await page.goto(`${origin}${root}/portal/master-data-entry/reports`);
  await expect(page.locator("#sign-in-error")).toContainText(
    "does not have access to this workspace",
  );
  await expect(
    page.getByRole("heading", { name: "Access denied", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Login ID", { exact: true })).toBeVisible();
});
for (const width of [320, 390, 1440]) {
  test(`missing-page recovery is responsive at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    const response = await page.goto(`${origin}/unknown-campus-page`);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Let’s get you back on track." }),
    ).toBeVisible();
    const dashboard = page.getByRole("link", {
      name: "Back to dashboard",
      exact: true,
    });
    await expect(dashboard).toHaveAttribute("href", `${root}/portal/login`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByText("Explore the templates", { exact: true }),
    ).toHaveCount(0);
    await dashboard.click();
    await expect(page.getByLabel("Login ID", { exact: true })).toBeVisible();
  });
}
test("Back to dashboard restores the signed-in workspace", async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.goto(`${origin}/another-missing-page`);
  await page
    .getByRole("link", { name: "Back to dashboard", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`${root}/portal/admin/dashboard$`));
});
