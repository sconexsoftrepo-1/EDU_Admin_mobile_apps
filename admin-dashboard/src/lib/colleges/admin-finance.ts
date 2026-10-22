import type { CollegeState } from "./store";

export type AdminPeriod = "All records" | "This month" | "Last 7 days";
// Legacy browser-demo amounts are paise. SQL and the Flutter fixture use major INR units.
export function adminFinance(
  state: CollegeState,
  period: AdminPeriod,
  asOf: string,
) {
  const now = new Date(`${asOf}T12:00:00Z`);
  const first =
    period === "This month"
      ? `${asOf.slice(0, 7)}-01`
      : period === "Last 7 days"
        ? new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10)
        : "";
  const inPeriod = (date: string) => (!first || date >= first) && date <= asOf;
  const payments = state.payments.filter(
    (p) => p.status === "Completed" && inPeriod(p.date),
  );
  const expenses = state.expenses.filter(
    (e) => e.status === "Paid" && inPeriod(e.date),
  );
  const paidByStudent = new Map<string, number>();
  for (const p of state.payments)
    if (p.status === "Completed" && p.date <= asOf && p.studentId)
      paidByStudent.set(
        p.studentId,
        (paidByStudent.get(p.studentId) || 0) + (p.amount || 0),
      );
  const debtors = state.students
    .map((s) => {
      const paid = paidByStudent.get(s.id) || 0;
      const payable = Math.max(0, s.fee - s.scholarship);
      return {
        ...s,
        paid,
        payable,
        outstanding: Math.max(0, payable - paid),
        credit: Math.max(0, paid - payable),
      };
    })
    .sort((a, b) => b.outstanding - a.outstanding);
  const collected = payments.reduce((n, p) => n + (p.amount || 0), 0);
  const spent = expenses.reduce((n, e) => n + (e.amount || 0), 0);
  const external = expenses
    .filter((e) =>
      /external|university|examination/i.test(`${e.category} ${e.name}`),
    )
    .reduce((n, e) => n + (e.amount || 0), 0);
  return {
    first,
    asOf,
    period,
    payments,
    expenses,
    debtors,
    collected,
    spent,
    external,
    netMovement: collected - spent,
    outstanding: debtors.reduce((n, s) => n + s.outstanding, 0),
    scholarship: debtors.reduce((n, s) => n + s.scholarship, 0),
    feeTotal: debtors.reduce((n, s) => n + s.fee, 0),
    credit: debtors.reduce((n, s) => n + s.credit, 0),
    receiptCount: payments.length,
    dueStudents: debtors.filter((s) => s.outstanding > 0).length,
  };
}
