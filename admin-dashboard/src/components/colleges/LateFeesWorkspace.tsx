"use client";
/** Students charged a late fee for a missed semester due date; an admin can cancel a late fee. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlarmClock, BadgeCheck, CircleAlert, RefreshCw, Search, Undo2, Users } from "lucide-react";
import { api, errorText, type LateFeeOverview, type LateFeeStudent } from "@/services/api";
import { Empty, LoadFailed, rupees, shortDate, Stat } from "./AnalyticsParts";
import SideDrawer from "./SideDrawer";
import { toast } from "./toast";
import "./fee-cash.css";

type Filter = "all" | "uncleared" | "cleared" | "cancelled";
const STATUS = { cleared: "Cleared", uncleared: "Not cleared", no_late_fee: "Late fee cancelled" } as const;
const FEE_STATUS = { unpaid: "Not paid", paid: "Paid", cancelled: "Cancelled" } as const;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

export default function LateFeesWorkspace() {
  const [data, setData] = useState<LateFeeOverview | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const load = useCallback(() => {
    setError("");
    return api.feePayments
      .lateFees()
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (data?.items || []).filter(
      (s) =>
        (filter === "all" ||
          (filter === "cancelled" ? s.late_fees_cancelled > 0 : s.status === filter)) &&
        (!text || [s.name, s.admission_number, s.course, s.branch].join(" ").toLowerCase().includes(text)),
    );
  }, [data, filter, query]);

  if (error && !data) return <LoadFailed message="Late fee dues could not be loaded." retry={load} />;
  if (!data)
    return (
      <div className="anw-loading" role="status" aria-label="Loading late fee dues…">
        <div className="anw-skeleton" />
        <div className="anw-skeleton anw-skeleton-tall" />
      </div>
    );
  const s = data.summary;
  const student = data.items.find((i) => i.student_code === open) || null;
  return (
    <div className="fcw">
      <header className="fcw-head">
        <div>
          <h1>Late fee dues</h1>
          <p>
            A late fee is added once per semester, the day after its due date, when that semester&apos;s fee is not fully paid.
            Set the amount on the course&apos;s fee structure.
          </p>
        </div>
        <button
          className="fcw-secondary"
          disabled={running}
          onClick={async () => {
            setRunning(true);
            try {
              await api.feePayments.applyLateFees();
              toast.success("Overdue semesters checked");
              await load();
            } catch (e) {
              toast.error("Could not check now", errorText(e));
            } finally {
              setRunning(false);
            }
          }}
        >
          <RefreshCw size={15} /> {running ? "Checking…" : "Check overdue now"}
        </button>
      </header>
      <div className="fcw-stats">
        <Stat icon={Users} label="Late fee applied" value={s.students} hint={`${rupees(Number(s.late_fee_total))} in late fees`} />
        <Stat icon={BadgeCheck} label="Cleared" value={s.cleared} hint="Semester fee and late fee paid" />
        <Stat icon={CircleAlert} label="Not cleared" value={s.uncleared} hint={`${rupees(Number(s.late_fee_pending))} late fee pending`} tone={s.uncleared ? "warn" : undefined} />
        <Stat icon={Undo2} label="Cancelled by admin" value={s.cancelled} hint="Late fees removed" />
      </div>
      <div className="lfw-bar">
        <div className="fcw-tabs" role="tablist" aria-label="Show">
          {(
            [
              ["all", `All (${data.items.length})`],
              ["uncleared", `Not cleared (${s.uncleared})`],
              ["cleared", `Cleared (${s.cleared})`],
              ["cancelled", "With cancelled late fees"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <label className="fcw-search lfw-search">
          <Search size={15} />
          <input placeholder="Search name, admission number, course…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      {shown.length ? (
        <ul className="lfw-grid">
          {shown.map((st) => (
            <li key={st.student_code}>
              <button className={`lfw-card is-${st.status}`} onClick={() => setOpen(st.student_code)}>
                <span className="lfw-top">
                  <span className="fcw-avatar" aria-hidden="true">
                    {initials(st.name)}
                  </span>
                  <span className="lfw-who">
                    <strong>{st.name}</strong>
                    <small>{st.admission_number || "No admission number"}</small>
                  </span>
                  <span className={`lfw-chip is-${st.status}`}>{STATUS[st.status]}</span>
                </span>
                <span className="lfw-course">
                  {[st.course, st.branch, st.current_semester ? `Semester ${st.current_semester}` : null].filter(Boolean).join(" · ") || "—"}
                </span>
                <span className="lfw-figures">
                  <span>
                    <small>Late fees</small>
                    <b>{st.late_fees_applied}</b>
                  </span>
                  <span>
                    <small>Paid</small>
                    <b>{rupees(Number(st.paid))}</b>
                  </span>
                  <span>
                    <small>Pending</small>
                    <b className={Number(st.pending) > 0 ? "is-due" : undefined}>{rupees(Number(st.pending))}</b>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <section className="fcw-card">
          <Empty>
            {data.items.length
              ? "No students match this filter."
              : "No late fees yet. They appear here when a semester's fee is not paid by its due date."}
          </Empty>
        </section>
      )}
      {student && <StudentLateFees student={student} canCancel={data.can_cancel} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}

function StudentLateFees({
  student: st,
  canCancel,
  onClose,
  onChanged,
}: {
  student: LateFeeStudent;
  canCancel: boolean;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const details: [string, string | number | null][] = [
    ["Admission number", st.admission_number],
    ["Course", [st.course_level, st.course].filter(Boolean).join(" · ") || null],
    ["Branch", st.branch],
    ["Academic year", st.academic_year],
    ["Current semester", st.current_semester ? `Semester ${st.current_semester}` : "Not in a semester now"],
    ["Fee paid", rupees(Number(st.paid))],
    ["Fee pending", rupees(Number(st.pending))],
    ["Late fees added", st.late_fees_applied],
    ["Late fees cancelled", st.late_fees_cancelled],
  ];
  async function cancel(key: string) {
    setBusy(true);
    try {
      await api.feePayments.cancelLateFee(key);
      toast.success("Late fee cancelled", "It is removed from the student's dues.");
      setConfirm(null);
      await onChanged();
    } catch (e) {
      toast.error("Late fee not cancelled", errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SideDrawer title={st.name} subtitle={`${STATUS[st.status]} · ${rupees(Number(st.pending))} pending`} onClose={onClose}>
      <div className="fcw-drawer-form">
        <dl className="fcw-details">
          {details
            .filter(([, v]) => v !== null && v !== "")
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
        <h3 className="lfw-sub">Late fees</h3>
        <ul className="lfw-fees">
          {st.late_fees.map((f) => (
            <li key={f.key} className={`is-${f.status}`}>
              <div className="lfw-fee-head">
                <AlarmClock size={16} aria-hidden="true" />
                <strong>
                  {f.label} · {rupees(Number(f.amount))}
                </strong>
                <span className={`lfw-chip is-${f.status === "paid" ? "cleared" : f.status === "unpaid" ? "uncleared" : "no_late_fee"}`}>
                  {FEE_STATUS[f.status]}
                </span>
              </div>
              <small>
                Due date missed: {shortDate(f.missed_due_date)} · added {shortDate(f.applied_on)}
                {f.status !== "cancelled" && Number(f.semester_outstanding) > 0
                  ? ` · semester fee still pending ${rupees(Number(f.semester_outstanding))}`
                  : ""}
                {f.status === "cancelled" ? ` · cancelled ${shortDate(f.cancelled_on)}${f.cancelled_by ? ` by ${f.cancelled_by}` : ""}` : ""}
              </small>
              {f.status === "unpaid" &&
                canCancel &&
                (confirm === f.key ? (
                  <div className="lfw-confirm" role="group" aria-label="Confirm cancelling the late fee">
                    <span>Remove this late fee from the student&apos;s dues?</span>
                    <button className="fcw-secondary" disabled={busy} onClick={() => setConfirm(null)}>
                      Keep it
                    </button>
                    <button className="lfw-danger" disabled={busy} onClick={() => cancel(f.key)}>
                      {busy ? "Cancelling…" : "Cancel late fee"}
                    </button>
                  </div>
                ) : (
                  <button className="lfw-cancel" onClick={() => setConfirm(f.key)}>
                    <Undo2 size={14} /> Cancel late fee
                  </button>
                ))}
            </li>
          ))}
        </ul>
        {!canCancel && <p className="lfw-note">Only an admin can cancel a late fee.</p>}
      </div>
    </SideDrawer>
  );
}
