import { apiRequest, ApiError } from "@/services/api/client";
import type { Row, Page } from "@/services/api/consts";
import { readWorkspaceCache, refreshWorkspaceCache } from "./workspace-cache";

/** Older API responses omit course level; resolve it from registered courses, once per role. */
export async function studentCourseLabels(
  rows: Row[],
  key: string | null,
): Promise<Row[]> {
  if (
    !rows.some(
      (row) => !row.course_level && (row.course_name || row.program_code),
    )
  )
    return rows;
  try {
    let courses = readWorkspaceCache<Row[]>(key);
    if (!courses)
      courses = await refreshWorkspaceCache(key, async () => {
        const all: Row[] = [];
        while (true) {
          const page = await apiRequest<Page<Row>>("academics/programs", {
            query: { offset: all.length, limit: 200 },
          });
          all.push(...page.items);
          if (!page.items.length || all.length >= page.total) return all;
        }
      });
    return rows.map((row) => {
      if (row.course_level) return row;
      const matches = courses!.filter(
        (course) =>
          course.code === row.program_code ||
          String(course.name).trim().toLowerCase() ===
            String(row.course_name || "")
              .trim()
              .toLowerCase(),
      );
      const course =
        matches.find((course) => course.code === row.program_code) ||
        (matches.length === 1 ? matches[0] : undefined);
      return course
        ? {
            ...row,
            course_level: course.course_level,
            course_name: row.course_name || course.name,
            branch: row.branch || course.branch,
          }
        : row;
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw error;
    return rows; // Labels must not prevent an otherwise authorized student register from loading.
  }
}
