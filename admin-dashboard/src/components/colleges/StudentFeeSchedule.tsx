"use client";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import { useEffect, useState } from "react";
import { apiRequest } from "@/services/api/client";
import { errorText } from "@/services/api";
import { money } from "@/data/colleges";
import "./fee-structures.css";

type Period = {
  year: number;
  semester?: number;
  due_date?: string | null;
  total: string;
  paid: string;
  balance: string;
  overdue: string;
  status?: string;
  heads?: { name: string; total: string; paid: string; balance: string }[];
};
type Ledger = {
  totals: {
    gross: string;
    paid: string;
    outstanding: string;
    discount: string;
    scholarship: string;
  };
  course_plans: {
    program_code: string;
    academic_year_code: string;
    terms: Period[];
    years: Period[];
  }[];
};
const amount = (value: string) => money(Math.round(Number(value) * 100));

export default function StudentFeeSchedule({
  studentCode,
}: {
  studentCode: string;
}) {
  const [result, setResult] = useState<{
    code: string;
    ledger?: Ledger;
    error?: string;
  }>();
  useEffect(() => {
    let active = true;
    void apiRequest<Ledger>(
      `finance/students/${encodeURIComponent(studentCode)}/ledger`,
    )
      .then((ledger) => {
        if (active) setResult({ code: studentCode, ledger });
      })
      .catch((error) => {
        if (active) setResult({ code: studentCode, error: errorText(error) });
      });
    return () => {
      active = false;
    };
  }, [studentCode]);
  if (result?.code !== studentCode)
    return <WorkspaceSkeleton compact label="Loading student fee schedule" />;
  if (!result.ledger)
    return <p role="alert">{result.error || "Unable to load fee schedule."}</p>;
  const { totals, course_plans = [] } = result.ledger;
  return (
    <section
      className="erp-panel erp-fee-student"
      aria-label="Student fee schedule"
    >
      <h2>Student fee schedule</h2>
      <dl className="erp-fee-card-totals">
        {Object.entries({
          "Total assigned": totals.gross,
          Paid: totals.paid,
          "Concessions & scholarships": String(
            Number(totals.discount) + Number(totals.scholarship),
          ),
          Balance: totals.outstanding,
        }).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{amount(value)}</dd>
          </div>
        ))}
      </dl>
      {course_plans.map((plan) => (
        <div key={`${plan.program_code}-${plan.academic_year_code}`}>
          <h3>{plan.program_code} · Full course</h3>
          <p className="erp-help">
            Net payable includes approved concessions. Recorded payments are
            attributed to the earliest semester balances first. Semesters
            without a due date remain unscheduled.
          </p>
          <div className="erp-fee-manager-scroll">
            <table aria-label="Semester payment breakdown">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Due date</th>
                  <th>Payable</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Overdue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {plan.years.map((year) => (
                  <tr key={`year-${year.year}`} className="erp-fee-year-total">
                    <th>Year {year.year} total</th>
                    <td>—</td>
                    <td>{amount(year.total)}</td>
                    <td>{amount(year.paid)}</td>
                    <td>{amount(year.balance)}</td>
                    <td>{amount(year.overdue)}</td>
                    <td>Year summary</td>
                  </tr>
                ))}
                {plan.terms.map((term) => (
                  <tr key={term.semester}>
                    <th>
                      Year {term.year} · Semester {term.semester}
                      {!!term.heads?.length && (
                        <details>
                          <summary>Fee heads</summary>
                          <dl className="erp-fee-term-heads">
                            {term.heads.map((head, i) => (
                              <div key={i}>
                                <dt>{head.name}</dt>
                                <dd>
                                  {amount(head.total)} payable ·{" "}
                                  {amount(head.paid)} paid ·{" "}
                                  {amount(head.balance)} balance
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      )}
                    </th>
                    <td>{term.due_date || "Not scheduled"}</td>
                    <td>{amount(term.total)}</td>
                    <td>{amount(term.paid)}</td>
                    <td>{amount(term.balance)}</td>
                    <td>{amount(term.overdue)}</td>
                    <td>{term.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {!course_plans.length && (
        <p className="erp-help">
          No full-course semester plan is assigned to this student.
        </p>
      )}
    </section>
  );
}
