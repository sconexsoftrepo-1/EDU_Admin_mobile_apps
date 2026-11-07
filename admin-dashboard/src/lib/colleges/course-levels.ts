/** Course levels of the college. Polytechnic, B.P.Ed and M.P.Ed are semester-based like degrees. */
export const COURSE_LEVELS = [
  { key: "intermediate", label: "Intermediate", code: "INT" },
  { key: "degree", label: "Degree", code: "DEG" },
  { key: "polytechnic", label: "Polytechnic", code: "POLY" },
  { key: "bped", label: "B.P.Ed", code: "BPED" },
  { key: "mped", label: "M.P.Ed", code: "MPED" },
] as const;
export type CourseLevelKey = (typeof COURSE_LEVELS)[number]["key"];
export const levelLabel = (key: unknown) =>
  COURSE_LEVELS.find((l) => l.key === key)?.label;
