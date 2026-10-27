# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/pdf-preview.spec.ts >> View PDF opens a rendered report, downloads it and can reopen at 390px
- Location: tests/pdf-preview.spec.ts:86:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: 'PDF-APPLICATION', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog', { name: 'PDF-APPLICATION', exact: true }) with timeout 5000ms
  - waiting for getByRole('dialog', { name: 'PDF-APPLICATION', exact: true })

```

```yaml
- group:
  - link "Skip to content":
    - /url: "#erp-content"
  - banner:
    - link "Pragathi":
      - /url: /colleges-institutions/edunexa-college/portal/admin
    - text: Admissions
    - button "Open portal navigation":
      - img
    - combobox "Search portal modules"
    - button "Open notifications":
      - img
    - group: AD
  - main:
    - button "Filters 0 active":
      - text: Filters 0 active
      - img
    - button "Manage Admissions":
      - text: Manage Admissions
      - img
    - heading "Admissions" [level=1]
    - paragraph: Inquiry → Application → Verification → Approval → Fee assignment → Enrollment
    - button "New application":
      - img
      - text: New application
    - button "Application 0":
      - text: Application
      - strong: "0"
    - button "Verification 0":
      - text: Verification
      - strong: "0"
    - button "Approved 0":
      - text: Approved
      - strong: "0"
    - button "Enrolled 0":
      - text: Enrolled
      - strong: "0"
    - button "Rejected 0":
      - text: Rejected
      - strong: "0"
    - button "Website 0":
      - text: Website
      - strong: "0"
    - button "Walk-in 0":
      - text: Walk-in
      - strong: "0"
    - button "Social Media 0":
      - text: Social Media
      - strong: "0"
    - button "Referral 0":
      - text: Referral
      - strong: "0"
    - button "Campaign 0":
      - text: Campaign
      - strong: "0"
    - button "Education Fair 0":
      - text: Education Fair
      - strong: "0"
    - button "Other 0":
      - text: Other
      - strong: "0"
    - heading "Applications 1" [level=2]
    - button "Excel":
      - img
      - text: Excel
    - button "View PDF":
      - img
      - text: View PDF
    - button "PDF report"
    - button "Print"
    - img
    - textbox "Search Applications":
      - /placeholder: Search applications…
    - combobox "Status filter":
      - option "All statuses" [selected]
      - option "Submitted"
    - group: Columns
    - table:
      - rowgroup:
        - row "Select PDF-APPLICATION Id PDF-APPLICATION Name Preview Applicant Program BSC Source website Status Submitted Date Note Actions View details Details Edit application Request documents Approve Reject View PDF Acknowledgment":
          - cell "Select PDF-APPLICATION":
            - checkbox "Select PDF-APPLICATION"
          - cell "Id PDF-APPLICATION"
          - cell "Name Preview Applicant"
          - cell "Program BSC"
          - cell "Source website"
          - cell "Status Submitted"
          - cell "Date"
          - cell "Note"
          - cell "Actions View details Details Edit application Request documents Approve Reject View PDF Acknowledgment":
            - text: Actions
            - button "View details"
            - link "Details":
              - /url: /colleges-institutions/edunexa-college/portal/admin/admissions/PDF-APPLICATION
            - button "Edit application"
            - button "Request documents"
            - button "Approve"
            - button "Reject"
            - button "View PDF":
              - img
              - text: View PDF
            - button "Acknowledgment"
    - text: 1–1 of 1
    - combobox "Rows per page":
      - option "10 per page" [selected]
      - option "25 per page"
      - option "50 per page"
    - button "Previous page" [disabled]:
      - img
    - button "Next page" [disabled]:
      - img
  - contentinfo: Pragathi College / Campus management Pragathi College
- paragraph
- alert
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | const origin = process.env.EDUNEXA_TEST_BASE_URL;
  4   | test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");
  5   | 
  6   | async function openAdmissions(page: Page) {
  7   |   await page.route("**/api/college/**", async (route) => {
  8   |     const path = new URL(route.request().url()).pathname.split(
  9   |       "/api/college/",
  10  |     )[1];
  11  |     if (path === "auth/me")
  12  |       return route.fulfill({
  13  |         json: {
  14  |           account: {
  15  |             code: "PDF-USER",
  16  |             login_id: "preview-test",
  17  |             person_type: "system",
  18  |             workspace_scope: "college",
  19  |             session_code: "PDF-SESSION",
  20  |             clients: ["admin-web"],
  21  |             role_codes: ["SYSTEM-ADMIN"],
  22  |           },
  23  |           roles: [
  24  |             {
  25  |               code: "SYSTEM-ADMIN",
  26  |               name: "Super Admin",
  27  |               scope: "college",
  28  |               system_admin: true,
  29  |               permissions: {},
  30  |             },
  31  |           ],
  32  |         },
  33  |       });
  34  |     if (path.startsWith("workspace/screens/"))
  35  |       return route.fulfill({
  36  |         json: {
  37  |           key: path.split("/").at(-1),
  38  |           title: "Admissions",
  39  |           resources: path.endsWith("/admissions")
  40  |             ? [
  41  |                 {
  42  |                   name: "admission_applications",
  43  |                   title: "Applications",
  44  |                   path: "admissions/applications",
  45  |                   fields: [],
  46  |                   actions: ["view"],
  47  |                 },
  48  |               ]
  49  |             : [],
  50  |         },
  51  |       });
  52  |     if (path === "admissions/applications")
  53  |       return route.fulfill({
  54  |         json: {
  55  |           items: [
  56  |             {
  57  |               code: "PDF-APPLICATION",
  58  |               first_name: "Preview",
  59  |               last_name: "Applicant",
  60  |               email: "preview@example.edu",
  61  |               status: "submitted",
  62  |               applied_at: "2026-10-27",
  63  |               program_code: "BSC",
  64  |               source_code: "website",
  65  |             },
  66  |           ],
  67  |           total: 1,
  68  |         },
  69  |       });
  70  |     return route.fulfill({
  71  |       json: { items: [], total: 0, actions: [], summary: {} },
  72  |     });
  73  |   });
  74  |   await page.goto(
  75  |     `${origin}/colleges-institutions/edunexa-college/portal/admin/admissions`,
  76  |   );
  77  |   await expect(
  78  |     page
  79  |       .getByRole("row")
  80  |       .filter({ hasText: "Preview Applicant" })
  81  |       .getByRole("button", { name: "View PDF", exact: true }),
  82  |   ).toBeVisible();
  83  | }
  84  | 
  85  | for (const width of [390, 1440]) {
  86  |   test(`View PDF opens a rendered report, downloads it and can reopen at ${width}px`, async ({
  87  |     page,
  88  |   }) => {
  89  |     await page.setViewportSize({ width, height: 844 });
  90  |     await openAdmissions(page);
  91  |     await page
  92  |       .getByRole("row")
  93  |       .filter({ hasText: "Preview Applicant" })
  94  |       .getByRole("button", { name: "View PDF", exact: true })
  95  |       .click();
  96  |     const preview = page.getByRole("dialog", {
  97  |       name: "PDF-APPLICATION",
  98  |       exact: true,
  99  |     });
> 100 |     await expect(preview).toBeVisible();
      |                           ^ Error: expect(locator).toBeVisible() failed
  101 |     await expect(preview.locator('canvas[data-rendered="true"]')).toBeVisible({
  102 |       timeout: 20000,
  103 |     });
  104 |     await preview.getByText("Read page text", { exact: true }).click();
  105 |     await expect(preview.locator(".erp-pdf-page-text")).toContainText(
  106 |       "Preview Applicant",
  107 |     );
  108 |     const download = page.waitForEvent("download");
  109 |     await preview
  110 |       .getByRole("link", { name: "Download PDF", exact: true })
  111 |       .click();
  112 |     expect((await download).suggestedFilename()).toBe("PDF-APPLICATION.pdf");
  113 |     await expect(
  114 |       preview.getByRole("link", { name: "Open PDF in new tab" }),
  115 |     ).toHaveAttribute("target", "_blank");
  116 |     await preview.getByRole("button", { name: "Close PDF preview" }).click();
  117 |     await expect(preview).toHaveCount(0);
  118 |     await page
  119 |       .getByRole("row")
  120 |       .filter({ hasText: "Preview Applicant" })
  121 |       .getByRole("button", { name: "View PDF", exact: true })
  122 |       .press("Enter");
  123 |     await expect(preview).toBeVisible();
  124 |     await expect(preview.locator('canvas[data-rendered="true"]')).toBeVisible({
  125 |       timeout: 20000,
  126 |     });
  127 |   });
  128 | }
  129 | 
```