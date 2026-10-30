import { expect, test, type Page } from "@playwright/test";
import {
  courseLevelLabel,
  personPhotoUrl,
} from "../src/lib/colleges/person-photo";
import { studentCourseLabels } from "../src/lib/colleges/student-course-labels";
import { clearWorkspaceCache } from "../src/lib/colleges/workspace-cache";

test("private photo paths use the authenticated proxy and storage keys are never image URLs", () => {
  for (const url of [
    "/api/v1/documents/document/DOC-PHOTO/view",
    "api/v1/documents/document/DOC-PHOTO/view",
    "http://backend.example/api/v1/documents/document/DOC-PHOTO/view",
  ])
    expect(personPhotoUrl(url)).toBe("/api/college/documents/document/DOC-PHOTO/view");
  expect(personPhotoUrl("private/student/photo.jpg")).toBe("");
  expect(personPhotoUrl("https://")).toBe("");
  expect(personPhotoUrl("https://images.example/photo.jpg")).toBe(
    "https://images.example/photo.jpg",
  );
  expect(courseLevelLabel("intermediate")).toBe("Intermediate");
  expect(courseLevelLabel("degree")).toBe("Degree");
});

test("older student responses resolve course level from registered courses without repeated requests", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  clearWorkspaceCache();
  globalThis.fetch = async () => {
    calls++;
    return Response.json({
      items: [{ code: "MPC", name: "MPC", course_level: "intermediate" }],
      total: 1,
    });
  };
  try {
    for (let i = 0; i < 2; i++) {
      const rows = await studentCourseLabels(
        [{ code: "STUDENT-1", course_name: "MPC" }],
        "test-admin:ROOT:student-course-labels",
      );
      expect(rows[0].course_level).toBe("intermediate");
    }
    expect(calls).toBe(1);
  } finally {
    globalThis.fetch = previous;
    clearWorkspaceCache();
  }
});

const origin = process.env.EDUNEXA_TEST_BASE_URL;
const root = "/colleges-institutions/edunexa-college/portal/admin";
const student = {
  code: "STUDENT-1",
  first_name: "Asha",
  middle_name: "Rani",
  last_name: "Devi",
  student_name: "Asha Devi",
  course_level: "intermediate",
  course_name: "MPC",
  batch_year: "2026–2028",
  admission_number: "ADM-101",
  status: "active",
  email: "student@example.test",
  profile_photo_storage_key: "private/photo.jpg",
  profile_photo_url: "api/v1/documents/document/DOC-PHOTO/view",
};
const role = {
  code: "ROOT",
  name: "Super Admin",
  scope: "college",
  system_admin: true,
  permissions: {},
};

async function setup(page: Page) {
  await page.route("**/api/college/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/api/college/",
    )[1];
    if (path === "auth/me")
      return route.fulfill({
        json: {
          account: {
            code: "TABLE-ADMIN",
            login_id: "admin",
            person_type: "system",
            role_codes: [role.code],
            clients: ["admin-web"],
          },
          roles: [role],
        },
      });
    if (path.startsWith("workspace/screens/")) {
      const key = path.split("/").at(-1);
      return route.fulfill({
        json: {
          key,
          title: key,
          resources: ["students", "dashboard", "student-enrollment"].includes(
            key || "",
          )
            ? [
                {
                  name: "students",
                  title: "Students",
                  path: "academics/students",
                  fields: [],
                  actions: ["view", "edit"],
                },
              ]
            : [],
        },
      });
    }
    if (path === "academics/students")
      return route.fulfill({
        json: { items: [student], total: 1, filter_options: {} },
      });
    if (path === "documents/document/DOC-PHOTO/view")
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1cAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    if (path.startsWith("documents/files/"))
      return route.fulfill({ json: { items: [] } });
    if (path.startsWith("workspace/lookups/"))
      return route.fulfill({ json: [] });
    return route.fulfill({
      json: {
        items: [],
        total: 0,
        roles: [],
        screens: [],
        actions: [],
        summary: {},
      },
    });
  });
}

test.describe("student record presentation", () => {
  test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running dashboard");
  test("student directory and record manager show full names and working photo thumbnails", async ({
    page,
  }) => {
    await setup(page);
    await page.goto(`${origin}${root}/students`);
    const directory = page.locator(".erp-table-scroll table").first();
    await expect(
      directory.getByText("Asha Rani Devi", { exact: true }),
    ).toBeVisible();
    await expect(
      directory.getByText("Intermediate", { exact: true }),
    ).toBeVisible();
    await expect(directory.getByText("MPC", { exact: true })).toBeVisible();
    await expect(
      directory.getByRole("img", {
        name: "Photo of Asha Rani Devi",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Manage Students", exact: true })
      .click();
    const table = page
      .getByRole("dialog", { name: "Manage college records", exact: true })
      .locator(".edu-table table");
    await expect(table.getByRole("columnheader").first()).toHaveText(
      "Student name",
    );
    expect(
      (await table.getByRole("columnheader").allTextContents()).slice(0, 4),
    ).toEqual(["Student name", "Course level", "Course / branch", "Photo"]);
    await expect(
      table.getByRole("columnheader", { name: /Profile Photo|Storage Key/i }),
    ).toHaveCount(0);
    await expect(
      table.getByText("Asha Rani Devi", { exact: true }),
    ).toBeVisible();
    const photo = table.getByRole("img", {
      name: "Photo of Asha Rani Devi",
      exact: true,
    });
    await expect(photo).toHaveAttribute(
      "src",
      /\/api\/college\/documents\/document\/DOC-PHOTO\/view$/,
    );
    await expect
      .poll(() =>
        photo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    const files = table.getByRole("button", {
      name: "Files for Asha Rani Devi",
      exact: true,
    });
    await expect(files.locator("svg")).toHaveCount(1);
    await expect(files).toHaveText("");
  });

  test("dashboard hides transport/stock cards and the employee-link action", async ({
    page,
  }) => {
    await setup(page);
    await page.goto(`${origin}${root}/dashboard`);
    await expect(page.locator(".erp-welcome")).toBeVisible();
    await expect(page.getByText("Passengers", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Low stock", { exact: true })).toHaveCount(0);
    await page
      .getByRole("button", { name: "Manage Dashboard", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Manage college records", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Link employee record", exact: true }),
    ).toHaveCount(0);
  });
});
