import { expect, test, type Page } from "@playwright/test";

const origin = process.env.EDUNEXA_TEST_BASE_URL;
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");

async function openAdmissions(page: Page) {
  await page.route("**/api/college/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/api/college/",
    )[1];
    if (path === "auth/me")
      return route.fulfill({
        json: {
          account: {
            code: "PDF-USER",
            login_id: "preview-test",
            person_type: "system",
            workspace_scope: "college",
            session_code: "PDF-SESSION",
            clients: ["admin-web"],
            role_codes: ["SYSTEM-ADMIN"],
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
    if (path.startsWith("workspace/screens/"))
      return route.fulfill({
        json: {
          key: path.split("/").at(-1),
          title: "Admissions",
          resources: path.endsWith("/admissions")
            ? [
                {
                  name: "admission_applications",
                  title: "Applications",
                  path: "admissions/applications",
                  fields: [],
                  actions: ["view"],
                },
              ]
            : [],
        },
      });
    if (path === "admissions/applications")
      return route.fulfill({
        json: {
          items: [
            {
              code: "PDF-APPLICATION",
              first_name: "Preview",
              last_name: "Applicant",
              email: "preview@example.edu",
              status: "submitted",
              applied_at: "2026-10-27",
              program_code: "BSC",
              source_code: "website",
            },
          ],
          total: 1,
        },
      });
    return route.fulfill({
      json: { items: [], total: 0, actions: [], summary: {} },
    });
  });
  await page.goto(
    `${origin}/colleges-institutions/edunexa-college/portal/admin/admissions`,
  );
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Preview Applicant" })
      .getByRole("button", { name: "View PDF", exact: true }),
  ).toBeVisible();
}

for (const width of [390, 1440]) {
  test(`View PDF opens a rendered report, downloads it and can reopen at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await openAdmissions(page);
    await page
      .getByRole("row")
      .filter({ hasText: "Preview Applicant" })
      .getByRole("button", { name: "View PDF", exact: true })
      .click();
    const preview = page.getByRole("dialog", {
      name: "PDF-APPLICATION",
      exact: true,
    });
    await expect(preview).toBeVisible();
    await expect(preview.locator('canvas[data-rendered="true"]')).toBeVisible({
      timeout: 20000,
    });
    await preview.getByText("Read page text", { exact: true }).click();
    await expect(preview.locator(".erp-pdf-page-text")).toContainText(
      "Preview Applicant",
    );
    const download = page.waitForEvent("download");
    await preview
      .getByRole("link", { name: "Download PDF", exact: true })
      .click();
    expect((await download).suggestedFilename()).toBe("PDF-APPLICATION.pdf");
    await expect(
      preview.getByRole("link", { name: "Open PDF in new tab" }),
    ).toHaveAttribute("target", "_blank");
    await preview.getByRole("button", { name: "Close PDF preview" }).click();
    await expect(preview).toHaveCount(0);
    await page
      .getByRole("row")
      .filter({ hasText: "Preview Applicant" })
      .getByRole("button", { name: "View PDF", exact: true })
      .press("Enter");
    await expect(preview).toBeVisible();
    await expect(preview.locator('canvas[data-rendered="true"]')).toBeVisible({
      timeout: 20000,
    });
  });
}
