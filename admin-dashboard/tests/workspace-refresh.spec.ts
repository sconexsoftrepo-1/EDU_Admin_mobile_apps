import { expect, test, type Page } from "@playwright/test";

const origin = process.env.EDUNEXA_TEST_BASE_URL;
const root = "/colleges-institutions/edunexa-college/portal/master-data-entry";
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");

const resources = {
  programs: {
    name: "programs",
    title: "Programs",
    path: "academics/programs",
    fields: [],
    actions: ["view", "create", "edit"],
  },
  batches: {
    name: "batches",
    title: "Batches",
    path: "academics/batches",
    fields: [],
    actions: ["view", "create", "edit"],
  },
  students: {
    name: "students",
    title: "Students",
    path: "academics/students",
    fields: [],
    actions: ["view", "create", "edit"],
  },
  employees: {
    name: "employees",
    title: "Employees",
    path: "human-resources/employees",
    fields: [],
    actions: ["view", "create", "edit"],
  },
};
const titles: Record<string, string> = {
  "student-enrollment": "Student enrollment",
  "course-setup": "Courses & enrollment",
  "teaching-staff": "Teaching staff onboarding",
  "non-teaching-staff": "Non-teaching staff onboarding",
  "daily-labour": "Daily labour",
};
const role = {
  code: "MASTER-DATA-ENTRY",
  name: "Master Data Entry",
  scope: "college",
  screens: Object.keys(titles),
  permissions: Object.fromEntries(
    [
      "programs",
      "batches",
      "students",
      "employees",
      "teachers",
      "staff_profiles",
      "employee_salary_components",
    ].map((table) => [table, ["view", "create", "edit"]]),
  ),
};

async function setup(page: Page, screen: string) {
  const calls: string[] = [];
  const searches: string[] = [];
  let writes = 0;
  await page.clock.install();
  await page.route("**/api/college/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/api/college/",
    )[1];
    calls.push(path);
    if (path === "academics/students")
      searches.push(
        new URL(route.request().url()).searchParams.get("search") || "",
      );
    if (path === "auth/me")
      return route.fulfill({
        json: {
          account: {
            code: "REFRESH-USER",
            login_id: "refresh-test",
            person_type: "system",
            workspace_scope: "college",
            session_code: "REFRESH-SESSION",
            clients: ["admin-web"],
            role_codes: [role.code],
          },
          roles: [role],
        },
      });
    if (path.startsWith("workspace/screens/")) {
      const key = path.split("/").at(-1)!;
      return route.fulfill({
        json: {
          key,
          title: titles[key] || key,
          resources:
            key === "course-setup"
              ? [resources.programs, resources.batches]
              : key === "student-enrollment"
                ? [resources.students]
                : [resources.employees],
        },
      });
    }
    if (path === "master-data/actions")
      return route.fulfill({
        json: {
          actions: [
            {
              key: "create-batch",
              label: "Year-based batch",
              resource: "batches",
              path: "master-data/actions/create-batch",
              fields: [
                {
                  key: "program_code",
                  label: "Course",
                  type: "text",
                  required: true,
                },
                {
                  key: "batch.entry_year",
                  label: "Start year",
                  type: "integer",
                  required: true,
                },
                {
                  key: "batch.graduation_year",
                  label: "End year",
                  type: "integer",
                  required: true,
                },
              ],
            },
          ],
        },
      });
    if (path === "master-data/actions/create-batch") {
      writes++;
      return route.fulfill({
        json: { batch: { code: "BATCH", name: "2026–2029" } },
      });
    }
    if (path === "master-data/enrollment/batches/overview")
      return route.fulfill({
        json: { batches: [], totals: { batches: 0, students: 0 } },
      });
    if (path === "workspace/lookups/programs")
      return route.fulfill({ json: [{ value: "BSC", label: "B.Sc" }] });
    if (path === "master-data/staff-onboarding")
      return route.fulfill({ json: { items: [], total: 0 } });
    if (path === "workflows") return route.fulfill({ json: { actions: [] } });
    return route.fulfill({
      json: { items: [], total: 0, actions: [], summary: {} },
    });
  });
  await page.goto(`${origin}${root}/${screen}`);
  await expect(
    page.getByRole("heading", { name: titles[screen], exact: true }),
  ).toBeVisible();
  await page.clock.runFor(500);
  await page.waitForLoadState("networkidle");
  return { calls, searches, writes: () => writes };
}

async function idle(page: Page) {
  await page.clock.fastForward(130_000);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await page.clock.runFor(500);
  await page.waitForLoadState("networkidle");
}

test("student search, clearing and manual refresh keep using the current query", async ({
  page,
}) => {
  const { calls, searches } = await setup(page, "student-enrollment");
  expect(searches).toHaveLength(1);
  const input = page.getByRole("searchbox", {
    name: "Search records",
    exact: true,
  });
  await input.fill("Asha");
  await page.clock.runFor(300);
  await expect.poll(() => searches.at(-1)).toBe("Asha");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => searches.length).toBe(3);
  expect(searches.at(-1)).toBe("Asha");
  await input.fill("");
  await page.clock.runFor(300);
  await expect.poll(() => searches.length).toBe(4);
  expect(searches.at(-1)).toBe("");
  await page.waitForLoadState("networkidle");
  const baseline = calls.length;
  await idle(page);
  expect(calls).toHaveLength(baseline);
});

for (const screen of Object.keys(titles)) {
  test(`${screen} stays idle until its refresh button is clicked`, async ({
    page,
  }) => {
    const { calls } = await setup(page, screen);
    const baseline = calls.length;
    await idle(page);
    expect(calls).toHaveLength(baseline);
    const staff = /staff|labour/.test(screen);
    const target = staff
      ? "master-data/staff-onboarding"
      : screen === "student-enrollment"
        ? "academics/students"
        : `workspace/screens/${screen}`;
    const before = calls.filter((path) => path === target).length;
    await page
      .getByRole("button", {
        name: staff ? "Refresh staff" : "Refresh",
        exact: true,
      })
      .click();
    await expect
      .poll(() => calls.filter((path) => path === target).length)
      .toBe(before + 1);
    await expect(page.locator(".edu-spin")).toHaveCount(0);
    await page.clock.runFor(500);
    await page.waitForLoadState("networkidle");
    const refreshed = calls.length;
    await idle(page);
    expect(calls).toHaveLength(refreshed);
  });
}

test("batch counts only reload after opening, changing the course or refreshing", async ({
  page,
}) => {
  const { calls } = await setup(page, "course-setup");
  await page
    .getByRole("button", { name: "Year-based batch", exact: true })
    .click();
  await page.getByRole("button", { name: "Batch cards", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No batches created yet" }),
  ).toBeVisible();
  const target = "master-data/enrollment/batches/overview";
  const baseline = calls.filter((path) => path === target).length;
  await idle(page);
  expect(calls.filter((path) => path === target)).toHaveLength(baseline);
  await page
    .getByRole("button", { name: "Refresh counts", exact: true })
    .click();
  await expect
    .poll(() => calls.filter((path) => path === target).length)
    .toBe(baseline + 1);
  await page
    .getByRole("combobox", { name: "View batches for course" })
    .selectOption("BSC");
  await expect
    .poll(() => calls.filter((path) => path === target).length)
    .toBe(baseline + 2);
  await idle(page);
  expect(calls.filter((path) => path === target)).toHaveLength(baseline + 2);
});

test("creating a record refreshes the current screen once and then stays idle", async ({
  page,
}) => {
  const api = await setup(page, "course-setup");
  const target = "workspace/screens/course-setup";
  const before = api.calls.filter((path) => path === target).length;
  await page
    .getByRole("button", { name: "Year-based batch", exact: true })
    .click();
  const form = page.getByRole("dialog", {
    name: "Year-based batch",
    exact: true,
  });
  await form.getByLabel("Course", { exact: false }).fill("BSC");
  await form.getByLabel("Start year", { exact: false }).fill("2026");
  await form.getByLabel("End year", { exact: false }).fill("2029");
  await form.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(form).not.toBeVisible();
  expect(api.writes()).toBe(1);
  expect(api.calls.filter((path) => path === target)).toHaveLength(before + 1);
  await page.waitForLoadState("networkidle");
  const saved = api.calls.length;
  await idle(page);
  expect(api.calls).toHaveLength(saved);
});
