import { expect, test, type Page } from "@playwright/test";

const origin = process.env.EDUNEXA_TEST_BASE_URL;
const path = "/colleges-institutions/edunexa-college/portal/login";
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");
const roles = [
  { code: "SYSTEM-ADMIN", name: "Super Admin" },
  { code: "MASTER-DATA-ENTRY", name: "Master Data Entry" },
  ...Array.from({ length: 14 }, (_, i) => ({
    code: `ROLE-${i}`,
    name: `Assigned role ${i + 1}`,
  })),
];

async function openLogin(page: Page) {
  await page.route("**/api/college/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth/roles"))
      return route.fulfill({ json: { roles } });
    return route.fulfill({ status: 401, json: { detail: "Please sign in" } });
  });
  await page.goto(`${origin}${path}`);
  await expect(page.getByRole("combobox", { name: "Role" })).toBeEnabled();
}

for (const [width, height] of [
  [320, 640],
  [375, 667],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [844, 390],
  [1280, 500],
]) {
  test(`login and open role list fit ${width} × ${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await openLogin(page);
    const submit = page.getByRole("button", { name: "Sign in", exact: true });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport();
    await expect(page.getByLabel("Login ID", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const logo = page.getByAltText("Pragathi College logo");
    expect(
      await logo.evaluate(
        (img: HTMLImageElement) =>
          img.complete &&
          img.naturalWidth > 0 &&
          getComputedStyle(img).objectFit === "contain",
      ),
    ).toBe(true);
    const picker = page.getByRole("combobox", { name: "Role" });
    await picker.click();
    const list = page.getByRole("listbox", { name: "Role" });
    await expect(list).toBeVisible();
    const bounds = await list.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    await expect
      .poll(async () => {
        const box = await list.boundingBox();
        return box ? box.y + box.height : Infinity;
      })
      .toBeLessThanOrEqual(height);
    await picker.press("End");
    await expect(page.getByRole("option").last()).toBeInViewport();
    await picker.press("Escape");
    await expect(list).toHaveCount(0);
    if ([390, 768, 1440].includes(width)) {
      await page.screenshot({
        path: `test-results/college-login-${width}.png`,
        fullPage: true,
      });
    }
  });
}

test("keyboard selection submits the API role code and preserves credentials after an error", async ({
  page,
}) => {
  await openLogin(page);
  let submitted: Record<string, string> = {};
  let requests = 0;
  await page.route("**/api/college/auth/login", async (route) => {
    requests++;
    submitted = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 401,
      json: { detail: "Invalid credentials" },
    });
  });
  const picker = page.getByRole("combobox", { name: "Role" });
  await picker.focus();
  await picker.press("Space");
  await picker.press("ArrowDown");
  await picker.press("Enter");
  await expect(picker).toContainText("Master Data Entry");
  await picker.click();
  await page
    .getByRole("heading", { name: "Welcome to Pragathi College" })
    .click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await picker.click();
  await picker.press("Tab");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await page.getByLabel("Login ID", { exact: true }).fill("college-user");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "test-password",
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Signing in…", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("#sign-in-error")).toContainText(
    "Login ID or password is incorrect",
  );
  expect(submitted).toMatchObject({
    login_id: "college-user",
    password: "test-password",
    role_code: "MASTER-DATA-ENTRY",
  });
  expect(requests).toBe(1);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "test-password",
  );
  await expect(page).toHaveURL(`${origin}${path}`);
});

test("200% zoom and reduced motion retain a scrollable, usable form", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openLogin(page);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const submit = page.getByRole("button", { name: "Sign in", exact: true });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  expect(
    await page
      .locator(".ca-card")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});

test("a reduced mobile viewport keeps password and submit reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLogin(page);
  await page.getByLabel("Password", { exact: true }).focus();
  // Simulates the reduced visual area; native OS keyboard requires a real device.
  await page.setViewportSize({ width: 390, height: 390 });
  await page.getByLabel("Password", { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByLabel("Password", { exact: true })).toBeInViewport();
  const submit = page.getByRole("button", { name: "Sign in", exact: true });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
});

test("login is the landing page and removed website URLs return to sign in", async ({
  page,
}) => {
  await openLogin(page);
  for (const entry of [
    "/",
    "/colleges-institutions",
    "/colleges-institutions/edunexa-college",
    "/colleges-institutions/edunexa-college/about",
    "/colleges-institutions/edunexa-college/admissions/apply",
  ]) {
    await page.goto(`${origin}${entry}`);
    await expect(page).toHaveURL(`${origin}${path}`);
    await expect(
      page.getByRole("heading", { name: "Welcome to Pragathi College" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to website" }),
    ).toHaveCount(0);
  }
});
