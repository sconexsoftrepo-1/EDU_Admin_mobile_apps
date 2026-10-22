import { z } from "zod";
import type { School } from "@/data/education";
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function admissionsSchema(school: School, today = todayISO()) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, "Enter the parent or guardian name.")
      .max(100),
    email: z.email("Enter a valid email address."),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,22}$/, "Enter a valid contact phone number.")
      .refine((v) => {
        const n = v.replace(/\D/g, "").length;
        return n >= 7 && n <= 15;
      }, "Use 7–15 digits."),
    grade: z
      .string()
      .refine(
        (v) => school.grades.includes(v),
        "Choose a grade offered by this school.",
      ),
    date: z.string().refine((v) => {
      const n = Date.parse(v + "T00:00:00Z");
      return (
        /^\d{4}-\d{2}-\d{2}$/.test(v) &&
        Number.isFinite(n) &&
        new Date(n).toISOString().slice(0, 10) === v &&
        v >= today
      );
    }, "Choose today or a future campus visit date."),
    message: z
      .string()
      .trim()
      .min(5, "Tell us a little about your enquiry.")
      .max(2000, "Please use 2,000 characters or fewer."),
  });
}
export type AdmissionsValues = z.infer<ReturnType<typeof admissionsSchema>>;
