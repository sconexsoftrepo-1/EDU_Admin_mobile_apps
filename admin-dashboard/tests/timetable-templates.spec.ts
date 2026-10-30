import { expect, test, type Page } from "@playwright/test";
import {
  createTimetable,
  addDayEdge,
  editCell,
  emptyCell,
  resizeCell,
  removePeriod,
} from "../src/lib/colleges/timetable-templates";

test("expanding and shrinking preserve text and never overwrite another class or cross breaks", () => {
  let draft = createTimetable("intermediate");
  draft = editCell(draft, { ...emptyCell(0, 0), title: "Mathematics" });
  const expanded = resizeCell(draft, 0, 0, 2);
  expect(expanded.cells.find((c) => c.day === 0 && c.row === 0)?.title).toBe(
    "Mathematics",
  );
  expect(() => resizeCell(expanded, 0, 0, 3)).toThrow("break or lunch");
  const occupied = editCell(draft, { ...emptyCell(0, 1), title: "English" });
  expect(() => resizeCell(occupied, 0, 0, 2)).toThrow("Clear the next class");
  expect(
    resizeCell(expanded, 0, 0, 1).cells.find((c) => c.day === 0)?.span,
  ).toBe(1);
});

test("removing a period adjusts merged blocks without leaving overlaps", () => {
  const draft = createTimetable("degree");
  const next = removePeriod(draft, 0);
  expect(next.periods).toHaveLength(draft.periods.length - 1);
  expect(next.cells.find((c) => c.day === 0)?.span).toBe(1);
  expect(next.cells.find((c) => c.day === 2)?.row).toBe(4);
});

test("morning and evening blocks preserve the original times and class content", () => {
  const draft = createTimetable("degree");
  const expanded = addDayEdge(addDayEdge(draft, "morning"), "evening");
  expect(expanded.periods[0].start).toBe("08:00");
  expect(expanded.periods.at(-1)?.end).toBe("17:00");
  expect(expanded.periods.slice(1, -1)).toEqual(draft.periods);
  expect(expanded.cells[0]).toEqual({
    ...draft.cells[0],
    row: draft.cells[0].row + 1,
  });
});

const origin = process.env.EDUNEXA_TEST_BASE_URL;
const root = "/colleges-institutions/edunexa-college/portal/admin/timetable";
const endpoint = "academics/timetable-templates";
const role = {
  code: "SYSTEM-ADMIN",
  name: "Super Admin",
  scope: "college",
  system_admin: true,
  permissions: {},
};
async function mock(page: Page, readOnly = false) {
  let saved: Record<string, unknown>[] = readOnly
    ? [
        {
          ...createTimetable("degree"),
          program_code: "DGR",
          batch_code: "DGR26",
          code: "TT-SAVED",
          name: "Saved class timetable",
          course_name: "B.Sc. Computer Science",
          batch_name: "2026–2029",
          revision: 1,
          updated_at: new Date().toISOString(),
        },
      ]
    : [];
  await page.route("**/api/college/**", async (route) => {
    const path = new URL(route.request().url()).pathname.split(
      "/api/college/",
    )[1];
    if (path === "auth/me")
      return route.fulfill({
        json: {
          account: {
            code: "TEST-USER",
            login_id: "admin",
            active: true,
            person_type: "system",
            role_codes: [role.code],
            clients: ["admin-web"],
          },
          roles: [role],
        },
      });
    if (path === `${endpoint}/options`)
      return route.fulfill({
        json: {
          courses: [
            { code: "INTER", name: "MPC", course_level: "intermediate" },
            {
              code: "DGR",
              name: "B.Sc. Computer Science",
              course_level: "degree",
            },
          ],
          batches: [
            {
              code: "INTER26",
              name: "2026–2028",
              program_code: "INTER",
              entry_year: 2026,
              graduation_year: 2028,
            },
            {
              code: "DGR26",
              name: "2026–2029",
              program_code: "DGR",
              entry_year: 2026,
              graduation_year: 2029,
            },
          ],
        },
      });
    if (
      path.startsWith(endpoint) &&
      ["POST", "PUT"].includes(route.request().method())
    ) {
      const body = route.request().postDataJSON();
      const record = {
        ...body,
        code: path.split("/")[2] || "TT-SAVED",
        revision: body.revision + 1,
        course_name: "B.Sc. Computer Science",
        batch_name: "2026–2029",
        updated_at: new Date().toISOString(),
      };
      saved = [record, ...saved.filter((r) => r.code !== record.code)];
      return route.fulfill({ status: 200, json: record });
    }
    if (path === endpoint)
      return route.fulfill({
        json: { items: saved, can_create: !readOnly, can_edit: !readOnly },
      });
    if (path.startsWith("workspace/screens/"))
      return route.fulfill({
        json: {
          key: path.split("/").at(-1),
          title: "Timetable",
          resources: [],
          actions: [],
        },
      });
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
  return () => saved;
}

test.describe("timetable browser flow", () => {
  test.skip(!origin, "Set EDUNEXA_TEST_BASE_URL to a running dashboard");
  test.setTimeout(90_000);
  for (const width of [390, 1440])
    test(`edit, resize, save and reopen a timetable at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      const saved = await mock(page);
      await page.goto(`${origin}${root}`);
      await expect(
        page.getByRole("heading", { name: "Timetable studio" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Degree Extended labs", exact: false })
        .click();
      await page
        .getByLabel("Timetable course", { exact: true })
        .selectOption("DGR");
      await page
        .getByLabel("Timetable batch year", { exact: true })
        .selectOption("DGR26");
      await page
        .getByRole("button", { name: "Create timetable", exact: true })
        .click();
      await page
        .getByLabel("Timetable title", { exact: true })
        .fill("Computer Science · Section A");
      await page
        .getByLabel("Monday period 1 subject", { exact: true })
        .fill("Computer laboratory");
      await page
        .getByLabel("Monday period 1 faculty", { exact: true })
        .fill("Dr. Rao");
      await page
        .getByLabel("Monday period 1 room", { exact: true })
        .fill("Lab 2");
      await page.getByLabel("Period 1 start", { exact: true }).fill("08:45");
      const normalCell = page
        .getByLabel("Thursday period 1 subject", { exact: true })
        .locator("..");
      const layout = await normalCell.evaluate(cell => {
        const parent = cell.getBoundingClientRect();
        return [...cell.querySelectorAll("input,textarea")].map(field => {
          const box = field.getBoundingClientRect();
          const css = getComputedStyle(field);
          return { field: field.getAttribute("aria-label"), top: box.top - parent.top, bottom: box.bottom - parent.top, height: parent.height, minHeight: css.minHeight, fieldHeight: css.height };
        });
      });
      for (const field of layout) {
        expect(field.top, JSON.stringify(layout)).toBeGreaterThanOrEqual(0);
        expect(field.bottom, JSON.stringify(layout)).toBeLessThanOrEqual(field.height - 10);
      }
      if (width === 1440) {
        await page
          .getByLabel("Wednesday period 1 subject", { exact: true })
          .fill("Physics");
        const handle = page.getByRole("button", {
          name: "Resize Wednesday period 1 class",
          exact: true,
        });
        await handle.scrollIntoViewIfNeeded();
        const box = (await handle.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          box.x + box.width / 2,
          box.y + box.height / 2 + 128,
          { steps: 8 },
        );
        await page.mouse.up();
        await expect(
          page.getByLabel("Wednesday period 2 subject", { exact: true }),
        ).toHaveCount(0);
      }
      await page
        .getByLabel("Tuesday period 1 subject", { exact: true })
        .fill("Mathematics");
      await page
        .getByRole("button", { name: "Expand selected class", exact: true })
        .click();
      await expect(
        page.getByLabel("Tuesday period 2 subject", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Expand selected class", exact: true })
        .click();
      await expect(page.locator(".tt-feedback[role=alert]")).toContainText(
        "break or lunch",
      );
      await page
        .getByRole("button", { name: "Save draft", exact: true })
        .click();
      await expect(page.locator(".tt-feedback[role=status]")).toContainText(
        "Draft saved",
      );
      expect(saved()[0].periods).toEqual(
        expect.arrayContaining([expect.objectContaining({ start: "08:45" })]),
      );
      expect(saved()[0].cells).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: "Mathematics", span: 2 }),
        ]),
      );
      await page.reload();
      await page
        .getByRole("button", {
          name: "Computer Science · Section A",
          exact: false,
        })
        .click();
      await expect(
        page.getByLabel("Monday period 1 subject", { exact: true }),
      ).toHaveValue("Computer laboratory");
      await expect(
        page.getByLabel("Period 1 start", { exact: true }),
      ).toHaveValue("08:45");
      await page
        .getByLabel("Monday period 1 subject", { exact: true })
        .fill("Updated practical");
      await page
        .getByRole("button", { name: "Save draft", exact: true })
        .click();
      await expect(page.locator(".tt-feedback[role=status]")).toContainText(
        "Draft saved",
      );
      expect(saved()[0].revision).toBe(2);
      await page.getByText("Manage periods & breaks", { exact: true }).click();
      await page
        .getByRole("button", { name: "Add morning period", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Add evening period", exact: true })
        .click();
      await expect(
        page.getByLabel("Period 1 start", { exact: true }),
      ).toHaveValue("07:45");
      await expect(
        page.getByLabel("Period 10 end", { exact: true }),
      ).toHaveValue("17:00");
      for (const row of [4, 6]) {
        const timing = page
          .getByLabel(`Period ${row} start`, { exact: true })
          .locator("..");
        const bounds = await timing.boundingBox();
        expect(bounds).not.toBeNull();
        for (const field of ["start", "end"]) {
          const box = await page
            .getByLabel(`Period ${row} ${field}`, { exact: true })
            .boundingBox();
          expect(box!.y).toBeGreaterThanOrEqual(bounds!.y);
          expect(box!.y + box!.height).toBeLessThanOrEqual(
            bounds!.y + bounds!.height,
          );
        }
      }
      await page
        .getByRole("button", { name: "Save draft", exact: true })
        .click();
      await expect(page.locator(".tt-feedback[role=status]")).toContainText(
        "Draft saved",
      );

      await page.screenshot({
        path: `/private/tmp/edunexa-timetable-reference/full-${width}.png`,
        fullPage: true,
      });
      const overflow = await page.evaluate(() => ({
        width: innerWidth,
        full: document.documentElement.scrollWidth,
        elements: [...document.querySelectorAll("body *")]
          .filter(
            (e) =>
              !e.closest(".tt-grid-scroll") &&
              e.getBoundingClientRect().right > innerWidth + 1 &&
              e.getBoundingClientRect().width > 0,
          )
          .slice(0, 12)
          .map((e) => ({
            tag: e.tagName,
            cls: e.className,
            width: e.getBoundingClientRect().width,
          })),
      }));
      await page.locator(".tt-editor").screenshot({
        path: `/private/tmp/edunexa-timetable-reference/editor-${width}.png`,
      });
      expect(overflow.full, JSON.stringify(overflow)).toBeLessThanOrEqual(
        overflow.width,
      );
      await page.locator(".tt-editor").screenshot({
        path: `/private/tmp/edunexa-timetable-reference/editor-${width}.png`,
      });
    });

  test("view-only accounts can reopen but cannot change a saved timetable", async ({
    page,
  }) => {
    await mock(page, true);
    await page.goto(`${origin}${root}`);
    await page
      .getByRole("button", { name: "Saved class timetable", exact: false })
      .click();
    await expect(
      page.getByLabel("Monday period 1 subject", { exact: true }),
    ).toHaveAttribute("readonly", "");
    await expect(
      page.getByRole("button", { name: "Save draft", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Create timetable", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".tt-resize")).toHaveCount(0);
  });
});
