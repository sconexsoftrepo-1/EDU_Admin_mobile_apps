"use client";
/**
 * HR & payroll: employee attendance (monthly), leave (balances, pending approvals, history) and
 * bonuses & incentives — for teaching and non-teaching staff. Backend: app/core/hr_workspace.py.
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Plus, RefreshCw, X } from "lucide-react";
import SearchField from "./SearchField";
import SideDrawer from "./SideDrawer";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import PDFActions from "./PDFActions";
import { toast, useErrorToast } from "./toast";
import { api, errorText } from "@/services/api";
import {
  payrollService,
  type LeaveBalance,
  type StaffDetail,
  type StaffListing,
  type StaffSummary,
} from "@/services/api/modules/payroll/service";
import "./staff/staff.css";
import "./payslips.css";
import "./staff-hr.css";
import { formatDate } from "@/lib/colleges/dates";

export type StaffHRView = "attendance" | "leave" | "bonuses";
const TITLES: Record<StaffHRView, string> = {
  attendance: "Employee attendance",
  leave: "Leave management",
  bonuses: "Bonuses & incentives",
};
const STATUS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  leave: "On leave",
  half_day: "Half day",
  holiday: "Holiday",
};
const inr = (v?: string | number | null) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));
const day = (v?: string | null) => (v ? formatDate(v.slice(0, 10)) : "—");

/** Taken | pending | remaining bar for one leave type. */
export function LeaveBar({ b }: { b: LeaveBalance }) {
  const total = Math.max(b.allowed, b.taken + b.pending, 1);
  const pct = (n: number) => `${(n * 100) / total}%`;
  return (
    <div className="hr-leave">
      <div className="hr-leave-head">
        <strong>{b.name}</strong>
        <span>
          {b.remaining} of {b.allowed} left
        </span>
      </div>
      <div
        className="hr-leave-bar"
        role="img"
        aria-label={`${b.name}: ${b.taken} taken, ${b.pending} pending, ${b.remaining} remaining of ${b.allowed}`}
      >
        <span className="taken" style={{ width: pct(b.taken) }} />
        <span className="pending" style={{ width: pct(b.pending) }} />
      </div>
      <small>
        {b.taken} taken · {b.pending} pending
      </small>
    </div>
  );
}

export default function StaffHRWorkspace({ view }: { view: StaffHRView }) {
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [data, setData] = useState<StaffListing | null>(null);
  const [kind, setKind] = useState<
    "" | "Teaching staff" | "Non-teaching staff"
  >("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useErrorToast(error);

  useEffect(() => {
    let live = true;
    payrollService
      .staff(month)
      .then((r) => live && setData(r))
      .catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [month, version]);

  const rows = useMemo(
    () =>
      (data?.items || []).filter(
        (r) =>
          (!kind || r.staff_kind === kind) &&
          `${r.name} ${r.code} ${r.designation || ""} ${r.department || ""}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [data, kind, query],
  );

  async function decide(code: string, status: "approved" | "rejected") {
    const note =
      status === "rejected"
        ? (window.prompt("Reason for rejecting (optional)") ?? null)
        : "";
    if (note === null) return;
    setBusy(code);
    try {
      await payrollService.decideLeave(code, status, note);
      toast.success(
        status === "approved" ? "Leave approved" : "Leave rejected",
        "The employee has been notified in the staff app.",
      );
      setVersion((n) => n + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }

  const teaching = (data?.items || []).filter(
    (r) => r.staff_kind === "Teaching staff",
  ).length;
  return (
    <section className="stf-dir" aria-label={TITLES[view]}>
      <header className="stf-dir-heading">
        <div>
          <p>HR &amp; payroll</p>
          <h1>{TITLES[view]}</h1>
        </div>
        <div className="hr-head-actions">
          {view === "attendance" && (
            <label className="pay-field">
              <span>Month</span>
              <input
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
            </label>
          )}
          {view === "bonuses" && data?.can_adjust && (
            <button
              type="button"
              className="stf-directory-add"
              onClick={() => setAdding(true)}
            >
              <Plus size={15} aria-hidden="true" /> Add bonus / incentive
            </button>
          )}
          <button
            className="stf-refresh"
            type="button"
            onClick={() => setVersion((n) => n + 1)}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
      </header>
      {!data ? (
        <WorkspaceSkeleton label={`Loading ${TITLES[view].toLowerCase()}`} />
      ) : (
        <>
          {view === "leave" && data.pending_leave.length > 0 && (
            <section className="stf-card hr-pending" aria-label="Pending leave">
              <h3>Waiting for approval ({data.pending_leave.length})</h3>
              <ul>
                {data.pending_leave.map((r) => (
                  <li key={r.code}>
                    <div>
                      <strong>{r.employee_name}</strong>
                      <small>
                        {r.leave_type_name} · {day(r.start_date)} →{" "}
                        {day(r.end_date)} · {r.days} day
                        {r.days === 1 ? "" : "s"}
                      </small>
                      <small>{r.reason}</small>
                    </div>
                    {data.can_decide && (
                      <div className="stf-row-actions">
                        <button
                          type="button"
                          className="icon-action"
                          title="Approve"
                          aria-label={`Approve ${r.employee_name}'s leave`}
                          disabled={busy === r.code}
                          onClick={() => void decide(r.code, "approved")}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-action"
                          title="Reject"
                          aria-label={`Reject ${r.employee_name}'s leave`}
                          disabled={busy === r.code}
                          onClick={() => void decide(r.code, "rejected")}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="stf-card">
            <div className="stf-dir-bar">
              <SearchField
                aria-label="Search employees"
                placeholder="Search employee, ID or department"
                value={query}
                onValueChange={setQuery}
              />
              <p>
                {teaching} teaching · {data.items.length - teaching}{" "}
                non-teaching
                {view === "attendance" ? ` · ${data.label}` : ""}
              </p>
              <div className="stf-directory-actions" role="tablist">
                {(
                  [
                    ["", "All staff"],
                    ["Teaching staff", "Teaching"],
                    ["Non-teaching staff", "Non-teaching"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={label}
                    type="button"
                    role="tab"
                    aria-selected={kind === k}
                    className={kind === k ? "stf-directory-add" : ""}
                    onClick={() => setKind(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="stf-table-wrap">
              <table className="stf-table hr-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    {view === "attendance" && (
                      <>
                        <th className="num">Present</th>
                        <th className="num">Half day</th>
                        <th className="num">Leave</th>
                        <th className="num">Absent</th>
                        <th className="num">Working days</th>
                        <th>Attendance</th>
                      </>
                    )}
                    {view === "leave" &&
                      (data.items[0]?.leave || []).map((t) => (
                        <th key={t.code}>{t.name}</th>
                      ))}
                    {view === "bonuses" && (
                      <>
                        <th className="num">Monthly gross</th>
                        <th className="num">Take-home</th>
                        <th className="num">
                          Bonuses &amp; incentives {data.year}
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Row key={r.code} r={r} view={view} onOpen={setOpen} />
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="stf-empty">No employees match this view.</p>
              )}
            </div>
          </div>
        </>
      )}
      {open && (
        <EmployeeDrawer
          code={open}
          month={month}
          view={view}
          onClose={() => setOpen(null)}
        />
      )}
      {adding && data && (
        <AdjustmentDrawer
          people={data.items}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            setVersion((n) => n + 1);
          }}
        />
      )}
    </section>
  );
}

function Row({
  r,
  view,
  onOpen,
}: {
  r: StaffSummary;
  view: StaffHRView;
  onOpen: (code: string) => void;
}) {
  const a = r.attendance;
  return (
    <tr className="hr-row" onClick={() => onOpen(r.code)}>
      <td>
        <button
          type="button"
          className="hr-name"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(r.code);
          }}
        >
          <strong>{r.name}</strong>
          <small>
            {[r.designation, r.department, r.staff_kind]
              .filter(Boolean)
              .join(" · ")}
          </small>
        </button>
      </td>
      {view === "attendance" && (
        <>
          <td className="num">{a.present}</td>
          <td className="num">{a.half_day}</td>
          <td className="num">{a.leave}</td>
          <td className="num">{a.absent}</td>
          <td className="num">{a.working_days}</td>
          <td>
            <div
              className="hr-meter"
              role="img"
              aria-label={`${a.percent ?? 0}% attendance`}
            >
              <span style={{ width: `${a.percent ?? 0}%` }} />
            </div>
            <small>{a.percent == null ? "—" : `${a.percent}%`}</small>
          </td>
        </>
      )}
      {view === "leave" &&
        r.leave.map((b) => (
          <td key={b.code}>
            <LeaveBar b={b} />
          </td>
        ))}
      {view === "bonuses" && (
        <>
          <td className="num">{inr(r.gross_monthly)}</td>
          <td className="num">{inr(r.net_monthly)}</td>
          <td className="num">
            <strong>{inr(r.bonus_ytd)}</strong>
          </td>
        </>
      )}
    </tr>
  );
}

function EmployeeDrawer({
  code,
  month,
  view,
  onClose,
}: {
  code: string;
  month: string;
  view: StaffHRView;
  onClose: () => void;
}) {
  const [d, setD] = useState<StaffDetail | null>(null);
  const [error, setError] = useState("");
  useErrorToast(error);
  useEffect(() => {
    payrollService
      .staffDetail(code, month)
      .then(setD)
      .catch((e) => setError(errorText(e)));
  }, [code, month]);
  return (
    <SideDrawer
      title={d?.name || "Employee"}
      subtitle={
        d
          ? [d.designation, d.department, d.staff_kind]
              .filter(Boolean)
              .join(" · ")
          : ""
      }
      onClose={onClose}
      expanded
      actions={
        <PDFActions
          viewLabel="View salary structure"
          onAction={(mode) =>
            api.documents.open(
              "salary-structure",
              code,
              `salary-structure-${code}.pdf`,
              mode,
            )
          }
        >
          Download PDF
        </PDFActions>
      }
    >
      {!d ? (
        <WorkspaceSkeleton compact label="Loading employee" />
      ) : (
        <div className="hr-drawer">
          {view === "attendance" && (
            <section>
              <h3>
                Attendance · {d.attendance_month.label}{" "}
                <small>
                  {d.attendance_month.percent ?? "—"}% ·{" "}
                  {d.attendance_month.present} present ·{" "}
                  {d.attendance_month.leave} leave · {d.attendance_month.absent}{" "}
                  absent
                </small>
              </h3>
              <div className="hr-days">
                {d.attendance_month.days.map((x) => (
                  <div
                    key={x.date}
                    className={`hr-day ${x.status || "none"}`}
                    title={`${day(x.date)} · ${STATUS[x.status || ""] || "Not marked"}${x.check_in ? ` · ${x.check_in.slice(0, 5)}–${(x.check_out || "").slice(0, 5)}` : ""}`}
                  >
                    <span>{x.weekday}</span>
                    <strong>{Number(x.date.slice(8))}</strong>
                    <small>{STATUS[x.status || ""] || "—"}</small>
                    {x.check_in && (
                      <small>
                        {x.check_in.slice(0, 5)}–
                        {(x.check_out || "").slice(0, 5)}
                      </small>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          <section>
            <h3>Leave balance {new Date().getFullYear()}</h3>
            <div className="hr-leave-grid">
              {d.leave.map((b) => (
                <LeaveBar key={b.code} b={b} />
              ))}
            </div>
          </section>
          {view !== "bonuses" && (
            <section>
              <h3>Leave history</h3>
              <table className="stf-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Dates</th>
                    <th className="num">Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.leave_history.map((r) => (
                    <tr key={r.code}>
                      <td>{r.leave_type_name}</td>
                      <td>
                        {day(r.start_date)} → {day(r.end_date)}
                      </td>
                      <td className="num">{r.days}</td>
                      <td>{r.reason}</td>
                      <td>
                        <span
                          className={`stf-docs-badge ${r.status === "approved" ? "done" : ""}`}
                        >
                          {r.status}
                        </span>
                        {r.approved_by_name && (
                          <small className="hr-by">
                            by {r.approved_by_name}
                          </small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!d.leave_history.length && (
                <p className="stf-empty">No leave taken yet.</p>
              )}
            </section>
          )}
          {view === "bonuses" && (
            <section>
              <h3>Bonuses, incentives &amp; reimbursements</h3>
              <table className="stf-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {d.adjustments.map((a) => (
                    <tr key={a.code}>
                      <td>{a.period}</td>
                      <td>
                        <span className="stf-docs-badge done">
                          {a.category}
                        </span>
                      </td>
                      <td>{a.component}</td>
                      <td className="num">{inr(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!d.adjustments.length && (
                <p className="stf-empty">No bonuses or incentives yet.</p>
              )}
            </section>
          )}
        </div>
      )}
    </SideDrawer>
  );
}

function AdjustmentDrawer({
  people,
  onClose,
  onSaved,
}: {
  people: StaffSummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await payrollService.addAdjustment({
        employee_code: String(f.get("employee")),
        month: String(f.get("month")),
        category: String(f.get("category")) as "Bonus",
        title: String(f.get("title")).trim(),
        amount: String(f.get("amount")),
      });
      toast.success(
        "Added to payroll",
        "It appears on that month's payslip (added now if payroll already ran).",
      );
      onSaved();
    } catch (err) {
      toast.error("Could not add", errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SideDrawer title="Add bonus or incentive" onClose={onClose}>
      <form className="hr-form" onSubmit={submit}>
        <label>
          <span>Employee</span>
          <select name="employee" required>
            {people.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} — {p.designation || p.staff_kind}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Payroll month</span>
          <input
            type="month"
            name="month"
            required
            defaultValue={new Date().toISOString().slice(0, 7)}
          />
        </label>
        <label>
          <span>Type</span>
          <select name="category">
            <option>Bonus</option>
            <option>Incentive</option>
            <option>Reimbursement</option>
          </select>
        </label>
        <label>
          <span>Description</span>
          <input
            name="title"
            required
            minLength={2}
            maxLength={120}
            placeholder="e.g. Festival bonus (Diwali)"
          />
        </label>
        <label>
          <span>Amount (INR)</span>
          <input name="amount" type="number" min="1" step="1" required />
        </label>
        <button type="submit" className="stf-directory-add" disabled={busy}>
          Add to payroll
        </button>
      </form>
    </SideDrawer>
  );
}
