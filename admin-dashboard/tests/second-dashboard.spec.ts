import { expect, test, type Page } from "@playwright/test";

const origin = process.env.EDUNEXA_TEST_BASE_URL;
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");

const enquiry = (key: string, reference: string, label: string, course: string, status: string, next: string | null) => ({
  key, code: key, visible: true, mine: key === "E1", name: `Applicant ${key}`, phone: "9876543210", reference_name: null, assigned_to: null,
  course_level: course === "BCA" ? "degree" : "intermediate", program_code: course, course_name: course, academic_year_code: null,
  academic_year: null, reference_type: reference, reference_label: label, status, stage: status === "joined" ? "joined" : "enquiry",
  has_application: false, next_follow_up_at: next, followups_done: 0, recorded_at: null,
});
const references = [["walk_in", "Walk-in / direct"], ["employee", "Employee reference"], ["staff", "Staff reference"], ["relative", "Relative reference"],
  ["advertising", "Advertising"], ["post", "Post / mail"], ["social_media", "Social media"], ["other", "Other"]].map(([key, label]) => ({ key, label }));
const admissions = {
  can_view_all: true,
  today: "2026-11-07",
  enquiries: [
    enquiry("E1", "staff", "Staff reference", "BCA", "joined", null),
    enquiry("E2", "social_media", "Social media", "MPC", "new", "2026-11-01T10:00:00Z"),
    enquiry("E3", "social_media", "Social media", "MPC", "contacted", null),
  ],
  applications: [],
  options: {
    references,
    courses: [{ code: "BCA", name: "BCA", level: "degree" }, { code: "MPC", name: "MPC", level: "intermediate" }],
    years: [],
  },
};
const campus = {
  today: "2026-11-07",
  collections: [
    { date: "2026-11-07", method: "cash", amount: 1000, purpose: "Tuition fee", year: "Y", department: "D" },
    { date: "2026-10-01", method: "bank_transfer", amount: 3000, purpose: "Hostel fee", year: "Y", department: "D" },
  ],
  dues: [
    { student_code: "S1", student: "Asha Rao", course: "BCA", department: "D", year: "Y", purpose: "Tuition fee", due_date: "2026-09-01", amount: 500, days_overdue: 67 },
    { student_code: "S2", student: "Ravi K", course: "BCA", department: "D", year: "Y", purpose: "Tuition fee", due_date: "2027-01-01", amount: 200, days_overdue: 0 },
  ],
  cashbook: { opening: 100, receipts: 1000, payments: 0, closing: 1100, recent: [] },
  expenses: [{ date: "2026-11-07", amount: 50, category: "Stationery", description: null, status: "unpaid" }],
  operations: { certificates: { label: "Pending certificates", value: 3, module: "certificates", hint: "Requests to issue" } },
  activity: [],
  options: { departments: [{ code: "D", name: "Science" }], years: [{ code: "Y", name: "2026-27" }] },
};

async function open(page: Page) {
  await page.route("**/api/college/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/dashboard/admission-analytics")) return route.fulfill({ json: admissions });
    if (path.endsWith("/dashboard/campus-analytics")) return route.fulfill({ json: campus });
    if (path.endsWith("/auth/me"))
      return route.fulfill({ json: {
        account: { code: "U", login_id: "u", active: true, role_codes: ["R"], clients: ["admin-web"], person_type: "employee", person_code: "E", login_code: "L", workspace_scope: "college" },
        roles: [{ code: "R", name: "Super Admin", scope: "college", system_admin: true, permissions: {} }],
      } });
    return route.fulfill({ status: 503, json: { detail: "Not mocked" } });
  });
  await page.goto(`${origin}/portal/admin/dashboard`);
}

test("admission filters drive every figure and all eight references are offered", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await expect(page.getByRole("heading", { name: "Admission analytics" })).toBeVisible({ timeout: 60_000 });
  const stat = (label: string) => page.locator(".anw-stat", { hasText: label });
  await expect(stat("Total enquiries")).toContainText("3");
  await expect(stat("Joined")).toContainText("1");
  await expect(stat("Conversion rate")).toContainText("33.3%");
  await expect(stat("Follow-ups due")).toContainText("1 overdue");
  const reference = page.locator("label.anw-filter", { hasText: /^Reference type/ }).locator("select");
  await expect(reference.locator("option")).toHaveCount(9);

  await reference.selectOption("social_media");
  await expect(stat("Total enquiries")).toContainText("2");
  await expect(stat("Joined")).toContainText("0");
  await expect(page.getByRole("cell", { name: "Applicant E1" })).toHaveCount(0);

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.locator("label.anw-filter", { hasText: /^Course level/ }).locator("select").selectOption("degree");
  await expect(page.locator("label.anw-filter", { hasText: /^Course \/ branch/ }).locator("option")).toHaveText(["All courses", "BCA"]);
  await expect(page.getByRole("cell", { name: "Applicant E2" })).toHaveCount(0);
});

test("campus insights separate overdue from outstanding and cash from other money", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await page.getByRole("tab", { name: "Campus insights" }).click();
  const stat = (label: string) => page.locator(".anw-stat", { hasText: label });
  await expect(stat("Total collections")).toContainText("₹4,000", { timeout: 60_000 });
  await expect(stat("Collected today")).toContainText("₹1,000");
  await expect(stat("Outstanding fees")).toContainText("₹700");
  await expect(stat("Overdue fees")).toContainText("₹500");
  await expect(stat("Cash balance")).toContainText("₹1,100");
  await page.locator("label.anw-filter", { hasText: /^Payment method/ }).locator("select").selectOption("cash");
  await expect(stat("Total collections")).toContainText("₹1,000");
});

test("no horizontal page scroll on either tab", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await page.locator(".anw-stat").first().waitFor({ timeout: 60_000 });
  for (const tab of ["Admission analytics", "Campus insights"]) {
    await page.getByRole("tab", { name: tab }).click();
    await page.locator(".anw-stat").first().waitFor({ timeout: 30_000 });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${tab} at ${width}px`).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({ width: 1440, height: 800 });
  }
});
