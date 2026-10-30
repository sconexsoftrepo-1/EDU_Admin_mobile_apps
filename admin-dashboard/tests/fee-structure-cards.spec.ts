import { expect, test } from "@playwright/test";
const origin = process.env.EDUNEXA_TEST_BASE_URL;
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");
test.setTimeout(60_000);
const heads = [
  ["tuition", "Tuition fee", "3500"],
  ["admission", "Admission fee", "500"],
  ["exam", "Examination fee", "300"],
  ["lab", "Laboratory fee", "200"],
  ["library", "Library fee", "100"],
  ["other", "Other charges", "50"],
  ["hostel", "Hostel fee", "2500"],
  ["transport", "Bus / transport fee", "1000"],
];
for (const width of [390, 1440]) {
  test(`saved MPC heads render once in a compact course card at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/api/college/**", async (route) => {
      const path = new URL(route.request().url()).pathname.split(
        "/api/college/",
      )[1];
      if (path === "auth/me")
        return route.fulfill({
          json: {
            account: {
              code: "U",
              login_id: "test",
              person_type: "system",
              workspace_scope: "college",
              role_codes: ["ROOT"],
              session_code: "test",
            },
            roles: [
              {
                code: "ROOT",
                name: "Super Admin",
                scope: "college",
                system_admin: true,
                permissions: {},
              },
            ],
          },
        });
      if (path.startsWith("workspace/screens/"))
        return route.fulfill({
          json: {
            key: path.split("/").at(-1),
            title: "Fees",
            resources: path.endsWith("fee-structures")
              ? [
                  {
                    name: "fee_structures",
                    path: "/api/v1/finance/fee_structures",
                    title: "Structures",
                    fields: [],
                    actions: ["view"],
                  },
                  {
                    name: "fee_heads",
                    path: "/api/v1/finance/fee_heads",
                    title: "Heads",
                    fields: [],
                    actions: ["view"],
                  },
                ]
              : [],
          },
        });
      if (path === "workspace/lookups/programs")
        return route.fulfill({ json: [{ value: "MPC", label: "Inter MPC" }] });
      if (path === "workspace/lookups/academic_years")
        return route.fulfill({ json: [{ value: "AY26", label: "2026–27" }] });
      if (path === "finance/fee_structures")
        return route.fulfill({
          json: {
            items: heads.map(([code, , amount]) => ({
              code: `FEE-${code}`,
              fee_head_code: code,
              program_code: "MPC",
              academic_year_code: "AY26",
              semester_number: 1,
              installment_number: 1,
              billing_frequency: "annual",
              fee_basis: "full_course",
              term_count: 4,
              term_due_dates: [null, null, null, null],
              amount,
              due_date: "2026-12-24",
              currency: "INR",
            })),
            total: heads.length,
            offset: 0,
            limit: 100,
          },
        });
      if (path === "finance/fee_heads")
        return route.fulfill({
          json: {
            items: heads.map(([code, name]) => ({ code, name })),
            total: heads.length,
            offset: 0,
            limit: 100,
          },
        });
      return route.fulfill({
        json: { items: [], total: 0, actions: [], screens: [] },
      });
    });
    await page.goto(
      `${origin}/portal/admin/fee-structures`,
    );
    const card = page.getByRole("article", { name: "Inter MPC fee structure" });
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".erp-fee-card")).toHaveCount(1);
    await expect(card).toContainText("2 years · 4 semesters");
    await expect(card).toContainText("Full course total");
    await expect(card.locator(".erp-fee-card-breakdown dl > div")).toHaveCount(
      8,
    );
    await expect(
      card
        .locator(".erp-fee-card-breakdown dl > div")
        .filter({ hasText: "Tuition fee" }),
    ).toContainText("₹3,500");
    await expect(card.locator(".erp-fee-card-grand-total")).toContainText(
      "₹8,150",
    );
    await expect(card.getByText("University", { exact: true })).toHaveCount(0);
    expect((await card.boundingBox())!.height).toBeLessThan(700);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (process.env.EDUNEXA_TEST_SCREENSHOTS)
      await page.screenshot({
        path: `/private/tmp/edunexa-compact-fees-${width}.png`,
        fullPage: true,
      });
    await card
      .getByRole("button", { name: "Edit Inter MPC fee breakdown" })
      .click();
    const manager = page.getByRole("dialog", {
      name: "Manage college records",
    });
    await expect(manager).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(
      manager.getByRole("spinbutton", { name: "Amount 1", exact: true }),
    ).toHaveValue("3500.00");
    await expect(
      manager.getByRole("combobox", { name: "Course", exact: true }),
    ).toHaveValue("MPC");
    await manager.getByRole("button", { name: "Add fee row" }).click();
    await expect(
      manager.getByRole("combobox", { name: "Fee head 9", exact: true }),
    ).toBeVisible();
  });
}
