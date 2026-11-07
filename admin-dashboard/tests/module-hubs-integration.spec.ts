/** Real local stack: next start → cookie-authenticated proxy → disposable FastAPI store. */
import { test, expect } from "@playwright/test";
import { visibleHubs } from "../src/lib/colleges/module-hubs";
import { SCREEN_CATALOG } from "../src/services/api/modules/workspace/catalog";
import fs from "node:fs";
const origin = process.env.EDUNEXA_AUDIT_BASE_URL;
test.skip(
  !origin,
  "Requires the disposable audit backend and an isolated Next server.",
);
const widths = [1920, 1440, 1280, 1024, 768, 430, 390, 360];
test.beforeEach(async ({ page }) => {
  const login = await page.request.post(`${origin}/api/college/auth/login`, {
    headers: { origin: origin! },
    data: {
      login_id: "admin",
      password: "Strong-Test-Password-245!",
      role_code: "ROOT",
    },
  });
  expect(login.status(), await login.text()).toBe(200);
  const me = await (
    await page.request.get(`${origin}/api/college/auth/me`)
  ).json();
  await page.addInitScript(
    (family) =>
      localStorage.setItem("edunexa-admissions-popup-session", family),
    me.account.login_code,
  );
});
test("all hubs return real metrics and fit every requested width", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const measurements: unknown[] = [];
  for (const hub of visibleHubs(SCREEN_CATALOG.map((s) => s.key))) {
    const started = Date.now();
    const responsePromise = page.waitForResponse((r) =>
      r.url().includes(`/dashboard/modules/${hub.key}`),
    );
    await page.goto(`${origin}/portal/admin/hub-${hub.key}`);
    const response = await responsePromise;
    expect(response.status(), hub.key).toBe(200);
    const body = await response.json();
    await expect(page.locator(".mhub")).toBeVisible();
    await expect(page.locator(".mhub-loading")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: hub.title, exact: true }),
    ).toBeVisible();
    const destinations = hub.screens.filter(
      (screen) =>
        screen !== "module-admissions" &&
        body.destinations.some((destination: string) => destination === screen),
    );
    const expectedLinks = destinations.map((screen) => `/portal/admin/${screen}`);
    if (hub.key === "academics" && destinations.includes("module-academics"))
      expectedLinks.unshift("/portal/admin/module-academics?create=campus");
    expect(
      await page.locator(".mhub-links a").evaluateAll((links) =>
        links.map((link) => link.getAttribute("href")),
      ),
      hub.key,
    ).toEqual(expectedLinks);
    if (hub.key === "finance") {
      const trendPanel = page
        .locator(".anw-panel")
        .filter({
          has: page.getByRole("heading", {
            name: "Monthly collection trend",
            exact: true,
          }),
        });
      await expect(trendPanel.locator(".anw-bars")).toHaveCount(1);
      await expect(trendPanel.locator(".anw-donut")).toHaveCount(0);
    }
    for (const metric of body.metrics) {
      expect(await page.locator(".mhub-kpis").innerText()).toContain(
        metric.label,
      );
    }
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(200);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${hub.key} ${width}px`,
      ).toBeLessThanOrEqual(width);
    }
    measurements.push({
      module: hub.key,
      load_ms: Date.now() - started - widths.length * 200,
      metrics: body.metrics.length,
      links: hub.screens,
      checked_widths: widths,
    });
  }
  expect(errors).toEqual([]);
  fs.writeFileSync(
    "/tmp/pragathi-hub-integration-matrix.json",
    JSON.stringify(measurements, null, 2),
  );
});
test("admissions has one main card, legacy redirect and accessible document registers", async ({
  page,
}) => {
  await page.goto(`${origin}/portal/admin/hub-admissions`);
  await expect(page.locator(".mhub")).toBeVisible();
  await expect(page.locator(".mhub-loading")).toHaveCount(0);
  await expect(page.locator(".mhub-links a")).toHaveCount(1);
  await expect(page.locator(".mhub-links")).not.toContainText("Master data");
  await page
    .getByRole("link", { name: "More admission records", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Admission records", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Screen resource", exact: true }),
  ).toContainText("Document Verification Events");
  await expect(
    page.getByRole("combobox", { name: "Screen resource", exact: true }),
  ).toContainText("Student Document Links");
  await page.goto(`${origin}/portal/admin/module-admissions`);
  await expect(page).toHaveURL(/\/portal\/admin\/admissions$/);
  await expect(
    page.getByRole("heading", { name: "Admissions", exact: true }),
  ).toBeVisible();
});
test("student year selection agrees across cards and chart; attendance appears once", async ({
  page,
}) => {
  await page.goto(`${origin}/portal/admin/hub-students`);
  await expect(page.locator(".mhub")).toBeVisible();
  await expect(page.locator(".mhub-loading")).toHaveCount(0);
  const select = page.getByRole("combobox", {
    name: "Academic year",
    exact: true,
  });
  const options = await select
    .locator("option")
    .evaluateAll((elements) =>
      elements.map((e) => (e as HTMLOptionElement).value).filter(Boolean),
    );
  expect(options.length).toBeGreaterThan(0);
  const responsePromise = page.waitForResponse(
    (r) =>
      r.url().includes("/dashboard/modules/students?") &&
      r.url().includes(encodeURIComponent(options[0])),
  );
  await select.selectOption(options[0]);
  const body = await (await responsePromise).json();
  await expect(page.locator(".mhub")).toBeVisible();
  await expect(page.locator(".mhub-loading")).toHaveCount(0);
  const attendance = page
    .locator(".mhub-kpis .anw-stat")
    .filter({ hasText: "Student attendance" });
  await expect(attendance).toHaveCount(1);
  expect(await attendance.innerText()).toMatch(/%|Not marked/);
  const chart = body.charts.find((c: { title: string }) =>
    c.title.startsWith("Students by program"),
  );
  const active = body.metrics.find(
    (m: { label: string }) => m.label === "Active enrollments",
  ).value;
  expect(
    chart.items.reduce((n: number, i: { value: number }) => n + i.value, 0),
  ).toBeLessThanOrEqual(active);
});
test("every permitted workspace deep link opens without browser exceptions", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const results: unknown[] = [];
  for (const hub of visibleHubs(SCREEN_CATALOG.map((s) => s.key))) {
    for (const screen of hub.screens) {
      const suffix = screen === "module-admissions" ? "?records=documents" : "";
      const response = await page.goto(
        `${origin}/portal/admin/${screen}${suffix}`,
      );
      expect(response?.status(), screen).toBeLessThan(400);
      await expect(page.locator("#erp-content")).toBeVisible();
      await expect(
        page.locator("#erp-content").getByRole("heading").first(),
      ).toBeVisible();
      await expect(
        page.getByText("Your account or selected role does not have access", {
          exact: false,
        }),
      ).toHaveCount(0);
      results.push({
        module: hub.key,
        screen,
        http_status: response?.status(),
      });
      fs.writeFileSync(
        "/tmp/pragathi-workspace-deeplinks.json",
        JSON.stringify(results, null, 2),
      );
    }
  }
  fs.writeFileSync(
    "/tmp/pragathi-workspace-deeplinks.json",
    JSON.stringify(results, null, 2),
  );
  expect(errors).toEqual([]);
});

test("records API payload sizes, timings and browser long tasks", async ({
  page,
}) => {
  test.setTimeout(90000);
  const endpoints = [
    "dashboard/overview",
    "dashboard/campus-analytics",
    "academics/semester-workspace",
    "dashboard/modules/academics",
  ];
  const timings: unknown[] = [];
  for (const endpoint of endpoints) {
    const samples: number[] = [];
    let bytes = 0;
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      const response = await page.request.get(
        `${origin}/api/college/${endpoint}`,
      );
      expect(response.status(), endpoint).toBe(200);
      const body = await response.body();
      samples.push(Date.now() - start);
      bytes = body.length;
    }
    timings.push({
      endpoint,
      samples_ms: samples,
      median_ms: [...samples].sort((a, b) => a - b)[1],
      bytes,
    });
  }
  await page.addInitScript(() => {
    (window as unknown as { auditLongTasks: number[] }).auditLongTasks = [];
    new PerformanceObserver((list) => {
      (window as unknown as { auditLongTasks: number[] }).auditLongTasks.push(
        ...list.getEntries().map((e) => e.duration),
      );
    }).observe({ type: "longtask", buffered: true });
  });
  await page.goto(`${origin}/portal/admin/hub-students`);
  await expect(page.locator(".mhub-kpis")).toBeVisible();
  await page.waitForTimeout(300);
  const browser = await page.evaluate(() => ({
    navigation: performance
      .getEntriesByType("navigation")
      .map((e) => ({ duration: e.duration })),
    long_tasks_ms: (window as unknown as { auditLongTasks: number[] })
      .auditLongTasks,
  }));
  fs.writeFileSync(
    "/tmp/pragathi-audit-performance.json",
    JSON.stringify(
      {
        environment:
          "Disposable local fixture backend and production Next build; not production latency",
        timings,
        browser,
      },
      null,
      2,
    ),
  );
});

test("Academics starts with campus creation and opens the existing Campus form", async ({
  page,
}) => {
  await page.goto(`${origin}/portal/admin/hub-academics`);
  const cards = page.locator(".mhub-links a");
  await expect(cards.first()).toContainText("Create Campus");
  await expect(cards.nth(1)).toContainText("Courses & enrollment");
  await expect(cards.nth(2)).toContainText("Academics");
  await expect(cards.nth(1)).toHaveAttribute(
    "href",
    "/portal/admin/course-setup",
  );
  await expect(cards.nth(2)).toHaveAttribute("href", "/portal/admin/academics");

  await page.getByRole("button", { name: "Resources", exact: true }).click();
  await expect(cards).toHaveCount(2);
  await page
    .getByRole("textbox", { name: "Find a workspace" })
    .fill("track student submissions");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Assignments");
  await page.getByRole("button", { name: "Clear workspace search" }).click();
  await page.getByRole("button", { name: "All workspaces" }).click();

  await cards.first().focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Create Campuses", exact: true }),
  ).toBeVisible({ timeout: 25_000 });
  await expect(page).toHaveURL(/\/portal\/admin\/module-academics$/);
});
