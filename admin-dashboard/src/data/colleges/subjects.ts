export type CourseOffering = {
  id: string;
  program: string;
  semester: number;
  name: string;
  code: string;
  kind: "Class" | "Lab";
  credits: number;
  weeklyHours: number;
  units: string[];
  experiments: string[];
};
/** Optional subject reference catalog. EduNexa currently uses editable timetable records
 * and the same generic subject fallback it used before the standalone extraction. */
const configuredOfferings: CourseOffering[] = [];
export function courseOfferings(
  programName: string,
  semester: number,
): CourseOffering[] {
  return configuredOfferings.filter(
    (c) => c.program === programName && c.semester === semester,
  );
}
