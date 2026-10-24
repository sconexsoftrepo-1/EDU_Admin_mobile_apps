import { expect, test } from "@playwright/test";
import type { Row } from "../src/services/api";
const origin = process.env.EDUNEXA_TEST_BASE_URL;
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");
const fields = [
  { name: "code", type: "text", required: true },
  { name: "name", type: "text", required: true },
  { name: "description", type: "text" },
  { name: "collection_ownership", type: "text", required: true },
  { name: "external_party_code", type: "text", reference: "external_parties" },
  { name: "scholarship_eligible", type: "boolean", required: true },
  {
    name: "category",
    type: "text",
    choices: ["academic", "hostel", "transport", "other"],
  },
  { name: "category_label", type: "text" },
];
for (const width of [390, 1440])
  test(`fee head code, ownership and reusable categories at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const saved: Row[] = [];
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
            resources: path.endsWith("/fees")
              ? [
                  {
                    name: "fee_heads",
                    title: "Fee Heads",
                    path: "/api/v1/finance/fee-heads",
                    fields,
                    actions: ["view", "create", "edit"],
                  },
                  {
                    name: "external_parties",
                    title: "External parties",
                    path: "/api/v1/finance/external-parties",
                    fields: [],
                    actions: ["view", "create"],
                  },
                ]
              : [],
          },
        });
      if (path === "workspace/resources/fee_heads/form")
        return route.fulfill({ json: { form: null, values: {} } });
      if (
        path === "workspace/resources/fee_heads" &&
        route.request().method() === "POST"
      ) {
        saved.push(route.request().postDataJSON().values);
        return route.fulfill({ status: 201, json: saved.at(-1) });
      }
      if (path === "finance/fee-heads")
        return route.fulfill({
          json: { items: saved, total: saved.length, offset: 0, limit: 100 },
        });
      if (path === "workspace/lookups/external_parties")
        return route.fulfill({
          json: [{ value: "BOARD", label: "State Examination Board" }],
        });
      return route.fulfill({
        json: { items: [], total: 0, actions: [], screens: [], summary: {} },
      });
    });
    await page.goto(
      `${origin}/colleges-institutions/edunexa-college/portal/admin/fees`,
    );
    await page.locator(".erp-api-controls button").click();
    const manager = page.getByRole("dialog", {
      name: "Manage college records",
    });
    await manager
      .getByRole("button", { name: "Create record", exact: true })
      .click();
    const form = page.getByRole("dialog", {
      name: "Create Fee Heads",
      exact: true,
    });
    await expect(form.locator('input[name="code"]')).toHaveValue(
      /^FH-[A-F0-9]{12}$/,
    );
    await expect(
      form.getByRole("combobox", { name: "Collection ownership", exact: true }),
    ).toHaveValue("Internal — college income");
    await expect(
      form.getByRole("combobox", {
        name: "External organization",
        exact: true,
      }),
    ).toHaveCount(0);
    await form.locator('input[name="name"]').fill("Sports participation");
    await form.getByLabel("Category", { exact: true }).fill("Sports");
    await form
      .getByRole("combobox", { name: "Collection ownership", exact: true })
      .click();
    await form
      .getByRole("option", {
        name: "External — collected for another organization",
        exact: true,
      })
      .click();
    const party = form.getByRole("combobox", {
      name: "External organization",
      exact: true,
    });
    await party.click();
    await form
      .getByRole("option", { name: "State Examination Board", exact: true })
      .click();
    await form
      .getByRole("button", { name: "Create record", exact: true })
      .click();
    await expect(form).toHaveCount(0);
    expect(saved[0]).toMatchObject({
      category_label: "Sports",
      category: "academic",
      collection_ownership: "external",
      external_party_code: "BOARD",
    });
    await manager
      .getByRole("button", { name: "Create record", exact: true })
      .click();
    await expect(form.locator('datalist option[value="Sports"]')).toHaveCount(
      1,
    );
    await expect(
      form.getByRole("combobox", {
        name: "External organization",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(
      await form.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
  });
