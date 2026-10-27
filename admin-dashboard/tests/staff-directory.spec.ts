import { expect, test, type Page } from "@playwright/test";

const origin = process.env.EDUNEXA_TEST_BASE_URL;

test("compact detail tabs fit a small mobile drawer and support keyboard selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await setup(page, { kind: "labour" });
  await page
    .getByRole("button", { name: "View details for Asha Rao", exact: true })
    .click();
  const drawer = page.getByRole("dialog", { name: "Asha Rao", exact: true });
  const tabs = drawer.getByRole("navigation", { name: "Staff information" });
  const registered = tabs.getByRole("button", {
    name: "Registered details",
    exact: true,
  });
  await expect(registered).toHaveAttribute("aria-pressed", "true");
  const files = tabs.getByRole("button", {
    name: "Documents & files",
    exact: true,
  });
  await files.focus();
  await expect(files).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(files).toHaveAttribute("aria-pressed", "true");
  await expect(files).toHaveCSS("border-bottom-color", "rgb(164, 106, 39)");
  expect((await tabs.boundingBox())!.width).toBeLessThan(285);
  expect((await files.boundingBox())!.width).toBeLessThan(160);
  expect(await tabs.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    animations: "disabled",
    path: test.info().outputPath("compact-mobile-tabs.png"),
  });
});
const root =
  "/colleges-institutions/edunexa-college/portal/master-data-entry/teaching-staff";
test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running frontend.");
const code = "EMP-PRA-005";
const employee = {
  code,
  first_name: "Asha",
  last_name: "Rao",
  gender: "female",
  date_of_birth: "1990-04-12",
  email: "asha@example.edu",
  phone: "+91 9876500200",
  address: "5 College Road",
  city: "Hyderabad",
  state: "Telangana",
  postal_code: "500001",
  department_code: "DEP",
  campus_code: "CAMP",
  designation: "Lecturer",
  join_date: "2026-06-01",
  employment_type: "permanent",
  employee_type: "teacher",
  status: "active",
};
const profile = {
  code: "PROFILE",
  employee_code: code,
  qualification_level: "post_graduation",
  specialization: "Physics",
  qualification_certificates: [
    { name: "M.Sc marks memo", key: "certificate_m_sc_marks_memo" },
  ],
  aadhaar_number: "111122223333",
  pan_number: "ABCDE1234F",
  bank_account_holder: "Asha Rao",
  bank_account_number: "123456789012",
  bank_name: "SBI",
  bank_ifsc: "SBIN0001234",
  bank_branch: "Main",
  gross_monthly: "40000",
  deductions_monthly: "0",
  net_monthly: "40000",
  in_hand_monthly: "40000",
  ctc_annual: "480000",
  previous_experience: [
    {
      organization: "City College",
      role: "Lecturer",
      from_date: "2020-06-01",
      to_date: "2026-05-31",
      details: "Physics teaching",
    },
  ],
  employment_history: [
    {
      organization: "City College",
      designation: "Lecturer",
      from_date: "2020-06-01",
      to_date: "2026-05-31",
      reason_for_leaving: "Relocation",
    },
  ],
  achievements: [
    { title: "Best teacher", year: 2024, details: "Academic excellence" },
  ],
  document_checklist: {
    aadhaar_copy: { label: "Aadhaar copy", uploaded: true },
  },
};
const detail = {
  employee,
  profile,
  role: {
    code: "TEACHER",
    employee_code: code,
    qualification: "Post Graduation — Physics",
    specialization: "Physics",
    experience_years: 6,
  },
  department: "Physics",
  salary_components: [
    {
      code: "SALARY",
      employee_code: code,
      component: "Basic pay",
      component_type: "earning",
      amount: "40000",
    },
  ],
};

async function setup(
  page: Page,
  options: {
    editable?: boolean;
    failSave?: boolean;
    kind?: "teaching" | "non_teaching" | "labour";
  } = {},
) {
  const kind = options.kind || "teaching";
  const screen = {
    teaching: "teaching-staff",
    non_teaching: "non-teaching-staff",
    labour: "daily-labour",
  }[kind];
  const title = {
    teaching: "Teaching staff onboarding",
    non_teaching: "Non-teaching staff onboarding",
    labour: "Daily labour",
  }[kind];
  const recordDetail = {
    ...detail,
    employee: {
      ...employee,
      employee_type: {
        teaching: "teacher",
        non_teaching: "staff",
        labour: "labour",
      }[kind],
    },
    role:
      kind === "teaching"
        ? detail.role
        : kind === "non_teaching"
          ? {
              code: "STAFF",
              employee_code: code,
              responsibility: "Administration",
            }
          : null,
    profile: {
      ...profile,
      ...(kind === "labour"
        ? {
            qualification_level: null,
            qualification_certificates: [],
            salary_basis: "daily",
            salary_amount: "600",
            previous_experience: [],
            employment_history: [],
            achievements: [],
          }
        : {}),
    },
    salary_components: kind === "labour" ? [] : detail.salary_components,
  };
  let name = "Asha Rao";
  let submitted: Record<string, unknown> | undefined;
  let updates = 0;
  let creates = 0;
  const actions =
    options.editable === false ? ["view"] : ["view", "create", "edit"];
  const role = {
    code: "MASTER-DATA-ENTRY",
    name: "Master Data Entry",
    scope: "college",
    screens: [screen],
    permissions: {
      employees: actions,
      teachers: kind === "teaching" ? actions : ["view"],
      staff_profiles: kind === "non_teaching" ? actions : ["view"],
      employee_salary_components: kind === "labour" ? ["view"] : actions,
      documents: actions,
    },
  };
  await page.route("**/api/college/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/api/college/")[1];
    if (path === "auth/me")
      return route.fulfill({
        json: {
          account: {
            code: "VERIFY-STAFF",
            login_id: "staff-test",
            person_type: "system",
            workspace_scope: "college",
            session_code: "TEST-SESSION",
            role_codes: [role.code],
            clients: ["admin-web"],
          },
          roles: [role],
        },
      });
    if (path === `workspace/screens/${screen}`)
      return route.fulfill({
        json: {
          key: screen,
          title,
          resources: [
            {
              name: "employees",
              title: "Employees",
              path: "human-resources/employees",
              fields: [],
              actions,
            },
            {
              name: kind === "teaching" ? "teachers" : "staff_profiles",
              title: "Staff profile",
              path: "human-resources/teachers",
              fields: [],
              actions,
            },
          ],
        },
      });
    if (path === "master-data/staff-onboarding") {
      if (request.method() === "POST") creates++;
      return route.fulfill({
        json: {
          total: 1,
          items: [
            {
              employee_id: code,
              name,
              designation: "Lecturer",
              department: "Physics",
              qualification: "Post graduation",
              specialization: "Physics",
              phone: employee.phone,
              join_date: employee.join_date,
              employment_type: employee.employment_type,
              status: "active",
              net_monthly: "40000",
              documents_uploaded: 1,
              documents_expected: 2,
            },
          ],
        },
      });
    }
    if (path === `master-data/staff-onboarding/${code}`) {
      if (request.method() === "PUT") {
        updates++;
        submitted = request.postDataJSON();
        if (options.failSave)
          return route.fulfill({
            status: 409,
            json: {
              detail: "An employee with this Aadhaar number already exists",
            },
          });
        const personal = submitted!.personal as typeof employee;
        name = `${personal.first_name} ${personal.last_name}`;
        return route.fulfill({
          json: {
            ...recordDetail,
            employee: { ...recordDetail.employee, ...personal },
          },
        });
      }
      return route.fulfill({ json: recordDetail });
    }
    if (path === "master-data/staff-onboarding/options")
      return route.fulfill({
        json: {
          employee_id: "EMP-PRA-006",
          departments: ["Physics"],
          campuses: [{ code: "CAMP", name: "Main" }],
        },
      });
    if (path === `documents/files/employee/${code}`)
      return route.fulfill({
        json: {
          items: [
            {
              code: "FILE-1",
              original_filename: "aadhaar.png",
              mime_type: "image/png",
              document_type: "aadhaar_copy",
              size_bytes: 100,
              download_kind: "document",
            },
          ],
        },
      });
    if (path === "documents/document/FILE-1/view")
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA1kAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    return route.fulfill({
      json: { items: [], total: 0, actions: [], summary: {} },
    });
  });
  await page.goto(`${origin}${root.replace("teaching-staff", screen)}`);
  await expect(
    page.getByRole("heading", {
      name: title,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "View details for Asha Rao",
      exact: true,
    }),
  ).toBeVisible();
  return {
    payload: () => submitted,
    updates: () => updates,
    creates: () => creates,
  };
}

test("info drawer shows the complete registered record and original file preview", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "View details for Asha Rao", exact: true })
    .click();
  const drawer = page.getByRole("dialog", { name: "Asha Rao", exact: true });
  await expect(
    drawer.getByText("Academic excellence", { exact: true }),
  ).toBeVisible();
  await expect(drawer.getByText("123456789012", { exact: true })).toBeVisible();
  await drawer
    .getByRole("button", { name: "Documents & files", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "View aadhaar.png", exact: true })
    .click();
  await expect(
    drawer.getByRole("region", { name: "Preview aadhaar.png" }),
  ).toBeVisible();
  await drawer.getByRole("button", { name: "Close file preview" }).click();
  await drawer.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Edit teaching staff", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("First name *", { exact: true })).toHaveValue(
    "Asha",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("edit preloads onboarding fields, retains documents and updates the existing employee", async ({
  page,
}) => {
  const api = await setup(page);
  await page
    .getByRole("button", { name: "Edit Asha Rao", exact: true })
    .click();
  const drawer = page.getByRole("dialog", {
    name: "Edit teaching staff",
    exact: true,
  });
  await expect(page.getByLabel("First name *", { exact: true })).toHaveValue(
    "Asha",
  );
  await expect(page.getByLabel("Email *", { exact: true })).toHaveValue(
    "asha@example.edu",
  );
  await expect(page.getByPlaceholder("Enter Aadhaar number")).toHaveValue(
    "111122223333",
  );
  await expect(page.getByPlaceholder("Enter PAN number")).toHaveValue(
    "ABCDE1234F",
  );
  await expect(
    drawer.getByText("M.Sc marks memo", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "View aadhaar.png", exact: true }),
  ).toBeVisible();
  await page.getByLabel("First name *", { exact: true }).fill("Asha Updated");
  await drawer
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(drawer).toHaveCount(0);
  await expect(
    page.getByText("Asha Updated Rao", { exact: true }),
  ).toBeVisible();
  expect(api.updates()).toBe(1);
  expect(api.creates()).toBe(0);
  expect(api.payload()).toMatchObject({
    personal: { first_name: "Asha Updated", phone: "+91 9876500200" },
    bank: { account_number: "123456789012" },
    certificates: ["M.Sc marks memo"],
    salary: {
      components: [
        {
          component: "Basic pay",
          component_type: "earning",
          amount: "40000.00",
        },
      ],
    },
  });
});

test("failed save keeps the entered fields open", async ({ page }) => {
  await setup(page, { failSave: true });
  await page
    .getByRole("button", { name: "Edit Asha Rao", exact: true })
    .click();
  await page.getByLabel("First name *", { exact: true }).fill("Keep changes");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  const drawer = page.getByRole("dialog", {
    name: "Edit teaching staff",
    exact: true,
  });
  await expect(drawer.getByRole("alert")).toContainText(
    "Aadhaar number already exists",
  );
  await expect(page.getByLabel("First name *", { exact: true })).toHaveValue(
    "Keep changes",
  );
});

test("a view-only staff role has info and files but no edit action", async ({
  page,
}) => {
  await setup(page, { editable: false });
  await expect(
    page.getByRole("button", { name: "Edit Asha Rao", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "View details for Asha Rao", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
});

for (const width of [390, 1440]) {
  test(`staff edit is a scrollable side screen at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    await page
      .getByRole("button", { name: "Edit Asha Rao", exact: true })
      .click();
    await expect(page.getByLabel("First name *", { exact: true })).toHaveValue(
      "Asha",
    );
    const drawer = page.getByRole("dialog", {
      name: "Edit teaching staff",
      exact: true,
    });
    await expect
      .poll(async () => {
        const bounds = await drawer.boundingBox();
        return bounds ? bounds.x + bounds.width : Infinity;
      })
      .toBeLessThanOrEqual(width);
    expect((await drawer.boundingBox())!.x).toBeGreaterThanOrEqual(0);
    await page.screenshot({
      path: test.info().outputPath(`staff-edit-${width}.png`),
    });
    expect(
      await drawer
        .locator(".edu-record-drawer-body")
        .evaluate((el) => el.scrollHeight > el.clientHeight),
    ).toBe(true);
    await drawer
      .getByRole("button", { name: "View aadhaar.png", exact: true })
      .click();
    await expect(
      drawer.getByRole("region", { name: "Preview aadhaar.png" }),
    ).toBeVisible();
    await expect(
      drawer.getByRole("button", { name: "Save changes", exact: true }),
    ).toBeVisible();
  });
}

for (const kind of ["non_teaching", "labour"] as const) {
  const label = kind === "non_teaching" ? "non-teaching staff" : "daily labour";
  test(`${label} supports details, compact file tabs, document previews and editing`, async ({
    page,
  }) => {
    const api = await setup(page, { kind });
    await page
      .getByRole("button", { name: "View details for Asha Rao", exact: true })
      .click();
    const drawer = page.getByRole("dialog", { name: "Asha Rao", exact: true });
    const details = drawer.getByRole("button", {
      name: "Registered details",
      exact: true,
    });
    const files = drawer.getByRole("button", {
      name: "Documents & files",
      exact: true,
    });
    await expect(details).toHaveAttribute("aria-pressed", "true");
    await expect(
      drawer.getByRole("heading", {
        name: kind === "labour" ? "Identity & registration" : "Staff profile",
        exact: true,
      }),
    ).toBeVisible();
    await files.click();
    await expect(files).toHaveAttribute("aria-pressed", "true");
    await expect(details).toHaveAttribute("aria-pressed", "false");
    expect((await files.boundingBox())!.height).toBeLessThanOrEqual(40);
    await drawer
      .getByRole("button", { name: "View aadhaar.png", exact: true })
      .click();
    await expect(
      drawer.getByRole("region", { name: "Preview aadhaar.png" }),
    ).toBeVisible();
    await drawer.getByRole("button", { name: "Close file preview" }).click();
    await drawer.getByRole("button", { name: "Edit", exact: true }).click();
    const edit = page.getByRole("dialog", {
      name: `Edit ${label}`,
      exact: true,
    });
    await expect(page.getByLabel("First name *", { exact: true })).toHaveValue(
      "Asha",
    );
    await page.getByLabel("First name *", { exact: true }).fill("Updated");
    await edit
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(edit).toHaveCount(0);
    expect(api.payload()).toMatchObject({
      kind,
      personal: { first_name: "Updated" },
    });
    if (kind === "labour")
      expect(api.payload()).toMatchObject({
        salary: { basis: "daily", amount: "600.00", components: [] },
      });
    expect(api.updates()).toBe(1);
    expect(api.creates()).toBe(0);
  });
  test(`${label} view-only users cannot edit`, async ({ page }) => {
    await setup(page, { kind, editable: false });
    await expect(
      page.getByRole("button", { name: "Edit Asha Rao", exact: true }),
    ).toHaveCount(0);
  });
}
