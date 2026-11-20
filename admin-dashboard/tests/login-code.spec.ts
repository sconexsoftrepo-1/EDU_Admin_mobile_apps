import { expect, test, type Page } from "@playwright/test";

const origin = process.env.EDUNEXA_TEST_BASE_URL;
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");
const role = { code: "SYSTEM-ADMIN", name: "Super Admin", scope: "college", system_admin: true, permissions: {} };
const account = { code: "OTP-TEST", login_id: "otp-test", active: true, person_type: "system", role_codes: [role.code], clients: ["admin-web"], workspace_scope: "college", session_code: "otp-test-session" };

async function setup(page: Page, requestFails = false) {
  const attempts: { login: string; code: string; role_code: string }[] = [];
  let signedIn = false;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: (pattern: number | number[]) => {
      const state = window as Window & { haptics?: (number | number[])[] };
      (state.haptics ??= []).push(pattern); return true;
    } });
  });
  await page.route("**/api/college/**", (route) => {
    const path = new URL(route.request().url()).pathname.split("/api/college/")[1];
    if (path === "auth/roles") return route.fulfill({ json: { roles: [role] } });
    if (path === "auth/me") return route.fulfill(signedIn ? { json: { account, roles: [role] } } : { status: 401, json: { detail: "Please sign in" } });
    if (path === "auth/otp/request") return route.fulfill(requestFails ? { status: 429, json: { detail: "Too many requests" } } : { json: { sent: true } });
    if (path === "auth/otp/verify") {
      const body = route.request().postDataJSON(); attempts.push(body);
      if (body.code !== "012345") return route.fulfill({ status: 401, json: { detail: "Invalid code" } });
      signedIn = true; return route.fulfill({ json: { account, roles: [role] } });
    }
    if (path.startsWith("workspace/screens/")) return route.fulfill({ json: { key: path.split("/").at(-1), title: "Dashboard", resources: [] } });
    if (path === "chat/unread" || path.endsWith("pending-count")) return route.fulfill({ json: { count: 0 } });
    return route.fulfill({ json: { items: [], total: 0 } });
  });
  await page.goto(`${origin}/portal/login`);
  await expect(page.getByRole("combobox", { name: "Role" })).toBeEnabled();
  await page.getByLabel("Login ID or email", { exact: true }).fill("otp-test");
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  return attempts;
}

async function paste(page: Page, value: string, digit = 0) {
  await page.locator(".ca-otp input").nth(digit).evaluate((element, text) => {
    const clipboardData = new DataTransfer(); clipboardData.setData("text", text);
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true }));
  }, value);
}

test("typing, deletion, arrows and paste preserve the six-digit code", async ({ page }) => {
  const attempts = await setup(page);
  const digits = page.locator(".ca-otp input");
  await expect(digits).toHaveCount(6);
  await expect(digits.first()).toBeFocused();
  const submit = page.getByRole("button", { name: "Verify and sign in" });
  await expect(submit).toBeDisabled();
  await page.keyboard.type("12");
  await expect(digits.nth(2)).toBeFocused();
  await page.keyboard.press("Backspace");
  await expect(digits.nth(1)).toBeFocused();
  await expect(digits.nth(1)).toHaveValue("");
  await page.keyboard.press("ArrowLeft");
  await expect(digits.first()).toBeFocused();
  await page.keyboard.type("a");
  await expect(digits.first()).toHaveValue("1");
  await paste(page, "12 34-56");
  for (const [i, value] of [..."123456"].entries()) await expect(digits.nth(i)).toHaveValue(value);
  await submit.click();
  await expect(page.locator("#sign-in-error")).toContainText("wrong or has expired");
  await expect(page.locator(".ca-otp")).toHaveClass(/is-invalid/);
  await expect(digits.first()).toBeFocused();
  expect(await page.evaluate(() => (window as Window & { haptics?: unknown[] }).haptics)).toContainEqual([35, 50, 35]);
  await page.screenshot({ path: "/private/tmp/edunexa-login-code-error.png", fullPage: true });
  await paste(page, "012345");
  await expect(page.locator("#sign-in-error")).toHaveCount(0);
  await submit.click();
  await expect(page.getByText("Code verified. Opening your workspace…")).toBeVisible();
  await expect(page.locator(".ca-otp")).toHaveClass(/is-verified/);
  await expect.poll(() => page.evaluate(() => (window as Window & { haptics?: unknown[] }).haptics)).toContainEqual([15, 45, 25]);
  await expect(page).toHaveURL(/\/portal\/admin\//);
  expect(attempts.map((attempt) => attempt.code)).toEqual(["123456", "012345"]);
  expect(attempts[1]).toMatchObject({ login: "otp-test", role_code: role.code });
});

test("six boxes and actions fit mobile, tablet and desktop", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await setup(page);
  for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1024, 768], [1440, 900], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const group = page.getByRole("group", { name: "6-digit code" });
    await group.scrollIntoViewIfNeeded();
    const box = await group.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole("button", { name: "Change login" })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/private/tmp/edunexa-login-code-mobile.png", fullPage: true });
});

test("autofill distributes all digits; changing login clears the old code", async ({ page }) => {
  await setup(page);
  // Unsupported vibration must never block typing, autofill or verification.
  await page.evaluate(() => Object.defineProperty(navigator, "vibrate", { configurable: true, value: undefined }));
  const digits = page.locator(".ca-otp input");
  await digits.first().fill("012345");
  for (const [i, value] of [..."012345"].entries()) await expect(digits.nth(i)).toHaveValue(value);
  await expect(page.getByRole("button", { name: "Verify and sign in" })).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Role" })).toBeDisabled();
  await page.getByRole("button", { name: "Change login" }).click();
  await expect(digits).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Role" })).toBeEnabled();
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await expect(digits.first()).toHaveValue("");
  await expect(page.getByRole("button", { name: "Verify and sign in" })).toBeDisabled();
});

test("reduced motion suppresses animation and haptics while retaining errors", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await paste(page, "654321");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.locator(".ca-otp")).toHaveClass(/is-invalid/);
  expect(await page.locator(".ca-otp-digits").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  expect(await page.evaluate(() => (window as Window & { haptics?: unknown[] }).haptics || [])).toEqual([]);
});

test("request errors are announced without opening code entry", async ({ page }) => {
  await setup(page, true);
  await expect(page.getByRole("alert").filter({ hasText: "Too many code requests" }).first()).toBeVisible();
  await expect(page.locator(".ca-otp input")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send code", exact: true })).toBeEnabled();
});
