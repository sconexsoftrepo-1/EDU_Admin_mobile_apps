import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Field, Row } from "../src/services/api";

const origin = process.env.EDUNEXA_TEST_BASE_URL;
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");
const catalog = JSON.parse(
  readFileSync("../backend/app/contracts/schema-catalog.json", "utf8"),
) as { name: string; fields: Field[] }[];
const defaults: Record<string, Row> = {
  scholarships: { award_method: "fixed_amount", eligibility_rules: {} },
  expenses: { currency: "INR", payment_status: "unpaid" },
  notification_templates: { is_active: true },
  vehicle_trips: { status: "scheduled" },
  admission_sources: { is_active: true },
};
const resources = Object.fromEntries(
  catalog.map((table) => [
    table.name,
    {
      ...table,
      title: table.name.replaceAll("_", " "),
      path: `test/${table.name}`,
      actions: ["view", "create", "edit"],
    },
  ]),
);
async function setup(page: Page, table: string) {
  const saved: { table: string; values: Row }[] = [];
  const lookups: Record<string, { value: string; label: string }[]> = {
    campuses: [{ value: "CAMPUS", label: "Main campus" }],
    academic_years: [{ value: "YEAR", label: "2026–2027" }],
    employees: [],
    vehicles: [],
    admission_sources: [],
  };
  await page.route("**/api/college/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/api/college/",
    )[1];
    if (path === "auth/me")
      return route.fulfill({
        json: {
          account: {
            code: "FORM-TEST",
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
          key: "buses",
          title: "Buses",
          resources: [resources[table]],
        },
      });
    if (path.startsWith("workspace/lookups/"))
      return route.fulfill({ json: lookups[path.split("/").at(-1)!] || [] });
    const resource = path.match(/^workspace\/resources\/([^/]+)(\/form)?$/);
    if (resource) {
      const name = resource[1];
      if (resource[2])
        return route.fulfill({
          json: {
            form: null,
            values: {},
            defaults: defaults[name] || {},
            resource: resources[name],
          },
        });
      const values = {
        ...route.request().postDataJSON().values,
        code: `CREATED-${saved.length}`,
      };
      saved.push({ table: name, values });
      (lookups[name] ||= []).push({
        value: values.code,
        label: values.name || values.registration_number || values.code,
      });
      return route.fulfill({ status: 201, json: values });
    }
    if (path.startsWith("test/"))
      return route.fulfill({
        json: {
          items: saved.filter((r) => r.table === table).map((r) => r.values),
          total: saved.length,
        },
      });
    return route.fulfill({
      json: { items: [], total: 0, actions: [], screens: [], summary: {} },
    });
  });
  await page.goto(
    `${origin}/portal/admin/buses`,
  );
  await page.locator(".erp-api-controls button").click();
  await page
    .getByRole("dialog", { name: "Manage college records" })
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  const form = page.getByRole("dialog", {
    name: `Create ${resources[table].title}`,
    exact: true,
  });
  await expect(form).toBeVisible();
  return { form, saved };
}

async function pick(
  page: Page,
  field: ReturnType<Page["getByRole"]>,
  label: string,
) {
  await field.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

test("scholarship defaults submit and invalid rules show a useful error", async ({
  page,
}) => {
  const { form, saved } = await setup(page, "scholarships");
  await form.locator('input[name="name"]').fill("Merit scholarship");
  await pick(
    page,
    form.getByRole("combobox", { name: "Academic year code" }),
    "2026–2027",
  );
  await form.locator('input[name="maximum_amount"]').fill("500");
  await expect(form.locator('textarea[name="eligibility_rules"]')).toHaveValue(
    "{}",
  );
  await form.locator('textarea[name="eligibility_rules"]').fill("no rules");
  await form
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText(
    "Eligibility rules: enter valid JSON",
  );
  expect(saved).toHaveLength(0);
  await form.locator('textarea[name="eligibility_rules"]').fill("{}");
  await form
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  expect(saved[0].values).toMatchObject({
    award_method: "fixed_amount",
    eligibility_rules: {},
  });
});

test("notification template saves multiline body and defaults to active", async ({
  page,
}) => {
  const { form, saved } = await setup(page, "notification_templates");
  await form.locator('input[name="name"]').fill("Fee reminder");
  await pick(
    page,
    form.getByRole("combobox", { name: "Channel", exact: true }),
    "sms",
  );
  await form
    .locator('textarea[name="body"]')
    .fill("Please pay your fees.\nThank you.");
  await form
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  expect(saved[0].values).toMatchObject({
    channel: "sms",
    body: "Please pay your fees.\nThank you.",
    is_active: true,
  });
});

test("add bus saves and an empty vehicle dropdown can create and select a bus", async ({
  page,
}) => {
  const { form, saved } = await setup(page, "transport_routes");
  await form.locator('input[name="name"]').fill("City route");
  await pick(
    page,
    form.getByRole("combobox", { name: "Campus code", exact: true }),
    "Main campus",
  );
  await form.getByRole("button", { name: "Add Vehicles", exact: true }).click();
  const bus = page.getByRole("dialog", {
    name: "Create vehicles",
    exact: true,
  });
  await pick(
    page,
    bus.getByRole("combobox", { name: "Campus code", exact: true }),
    "Main campus",
  );
  await bus.locator('input[name="registration_number"]').fill("AP01AB1234");
  await bus.locator('input[name="capacity"]').fill("30");
  await bus.getByRole("button", { name: "Create record", exact: true }).click();
  await expect(bus).toHaveCount(0);
  await expect(
    form.getByRole("combobox", { name: "Vehicle code", exact: true }),
  ).toHaveValue("AP01AB1234");
  await expect(form.locator('input[name="name"]')).toHaveValue("City route");
  await form
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  expect(saved.map((r) => r.table)).toEqual(["vehicles", "transport_routes"]);
  expect(saved[1].values.vehicle_code).toBe(saved[0].values.code);
});

test("expense defaults submit valid status and currency", async ({ page }) => {
  const { form, saved } = await setup(page, "expenses");
  await pick(
    page,
    form.getByRole("combobox", { name: "Campus code", exact: true }),
    "Main campus",
  );
  await form.locator('input[name="category"]').fill("Utilities");
  await form.locator('textarea[name="description"]').fill("Electricity bill");
  await form.locator('input[name="amount"]').fill("100");
  await form
    .getByRole("textbox", { name: "Expense date", exact: true })
    .fill("29/10/2026");
  await form
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  expect(saved[0].values).toMatchObject({
    payment_status: "unpaid",
    currency: "INR",
    expense_date: "2026-10-29",
  });
});

test("empty admission source dropdown can create and select a source", async ({
  page,
}) => {
  const { form, saved } = await setup(page, "admission_enquiries");
  await form.locator('input[name="first_name"]').fill("New applicant");
  await form
    .getByRole("button", { name: "Add Admission sources", exact: true })
    .click();
  const source = page.getByRole("dialog", {
    name: "Create admission sources",
    exact: true,
  });
  await source.locator('input[name="name"]').fill("Walk in");
  await pick(
    page,
    source.getByRole("combobox", { name: "Channel", exact: true }),
    "walk_in",
  );
  await source
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await expect(source).toHaveCount(0);
  await expect(
    form.getByRole("combobox", { name: "Source code", exact: true }),
  ).toHaveValue("Walk in");
  await expect(form.locator('input[name="first_name"]')).toHaveValue(
    "New applicant",
  );
  expect(saved[0]).toMatchObject({
    table: "admission_sources",
    values: { is_active: true, channel: "walk_in" },
  });
});
