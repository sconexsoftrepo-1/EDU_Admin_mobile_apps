import type { Field, Row } from "@/services/api";

const education: [string, string, string, string[]?][] = [
  ["level", "Qualification level", "text", ["ssc", "intermediate"]],
  ["institution", "School / college name", "text"],
  ["board", "Board / university", "text"],
  ["group", "Group / stream", "text"],
  ["passed_year", "Year of passing", "integer"],
  ["grade", "Grade / percentage", "text"],
  ["first_year_score", "First-year score", "text"],
  ["second_year_score", "Second-year score", "text"],
];
export function studentEditForm(fields: Field[], initial: Row) {
  const stored = initial.previous_education;
  const previous =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Row)
      : {
          institution: initial.previous_institution,
          grade: initial.previous_score,
        };
  const values = { ...initial };
  const expanded = fields.flatMap((field) => {
    const key = field.key || field.name;
    if (
      [
        "previous_institution",
        "previous_qualification",
        "previous_score",
      ].includes(key || "")
    )
      return [];
    if (key !== "previous_education") return [field];
    return education.map(([name, label, type, choices]) => {
      const key = `previous_education.${name}`;
      values[key] = previous[name] ?? "";
      return {
        name: key,
        key,
        label,
        type,
        choices,
        section: "Previous education",
        required: false,
      };
    });
  });
  return { fields: expanded, initial: values };
}
export function studentEditValues(values: Row, initial: Row): Row {
  const result = { ...values };
  const previous =
    initial.previous_education && typeof initial.previous_education === "object"
      ? { ...(initial.previous_education as Row) }
      : {};
  let changed = false;
  for (const [name] of education) {
    const key = `previous_education.${name}`;
    if (key in result) {
      previous[name] = result[key] === "" ? null : result[key];
      delete result[key];
      changed = true;
    }
  }
  if (changed) result.previous_education = previous;
  return result;
}
