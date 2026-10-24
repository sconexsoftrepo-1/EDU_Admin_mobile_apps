import type { Field, Row } from "@/services/api";

const labels: Record<string, string> = {
  academic: "Academic",
  hostel: "Hostel",
  transport: "Transport",
  other: "Other",
};

export function feeHeadForm(fields: Field[], initial: Row, existing: Row[]) {
  const categories = [
    ...new Set(
      [
        ...Object.values(labels),
        ...existing.map((row) =>
          String(
            row.category_label ||
              labels[String(row.category)] ||
              row.category ||
              "",
          ).trim(),
        ),
        String(initial.category_label || ""),
      ].filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const configured = fields
    .filter((field) => (field.name || field.key) !== "category_label")
    .map((field) => {
      switch (field.name || field.key) {
        case "code":
          return {
            ...field,
            help: "Generated automatically. You can change this unique fee-head reference before saving.",
          };
        case "collection_ownership":
          return {
            ...field,
            choices: ["internal", "external"],
            help: "Internal: the college keeps the money. External: collected on behalf of another organization and tracked for remittance.",
          };
        case "external_party_code":
          return {
            ...field,
            label: "External organization",
            help: "Choose the organization that receives this money, such as a university or examination board. Add organizations in Manage fees → Screen resource → External parties.",
          };
        case "category":
          return {
            ...field,
            label: "Billing group",
            choices: Object.keys(labels),
            help: "Academic and Other apply to all enrolled students. Hostel and Transport apply only when the student selects those services.",
          };
        default:
          return field;
      }
    });
  configured.push({
    name: "category_label",
    type: "fee-category",
    label: "Category",
    required: true,
    choices: categories,
    help: "Choose an existing category or type a new one, such as Sports, Uniform, or Activities. Saving this fee head makes the category available next time.",
  });
  return {
    fields: configured,
    initial: {
      collection_ownership: "internal",
      category: "academic",
      scholarship_eligible: false,
      ...initial,
      code:
        initial.code ||
        `FH-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      category_label:
        initial.category_label ||
        labels[String(initial.category || "academic")] ||
        "Academic",
    },
  };
}
