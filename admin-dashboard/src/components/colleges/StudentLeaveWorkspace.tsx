"use client";
/** Student leave: requests from the student / parent app, with the student's course and batch. */
import { useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import SearchField from "./SearchField";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import { toast, useErrorToast } from "./toast";
import { apiRequest } from "@/services/api/client";
import { errorText } from "@/services/api";
import { formatDate } from "./DateInput";
import "./staff/staff.css";

type LeaveRow = {
  code: string;
  student_code: string;
  student_name: string;
  admission_number?: string | null;
  course_name?: string | null;
  academic_year_name?: string | null;
  section_name?: string | null;
  start_date: string;
  end_date: string;
  days?: number | null;
  reason: string;
  status: "pending" | "approved" | "rejected" | string;
  approved_by_name?: string | null;
  decision_note?: string | null;
};
type Listing = {
  items: LeaveRow[];
  total: number;
  can_decide: boolean;
  counts: Record<string, number>;
};
const FILTERS = ["pending", "approved", "rejected", "all"] as const;
const date = (v?: string | null) => (v ? formatDate(v.slice(0, 10)) : "—");

export default function StudentLeaveWorkspace() {
  const [data, setData] = useState<Listing | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useErrorToast(error);
  useEffect(() => {
    let active = true;
    apiRequest<Listing>("students/leave-workspace")
      .then((r) => active && setData(r))
      .catch((e) => active && setError(errorText(e)));
    return () => {
      active = false;
    };
  }, [version]);
  const rows = useMemo(
    () =>
      (data?.items || []).filter(
        (r) =>
          (filter === "all" || r.status === filter) &&
          `${r.student_name} ${r.admission_number || ""} ${r.course_name || ""} ${r.reason}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [data, filter, query],
  );
  async function decide(row: LeaveRow, status: "approved" | "rejected") {
    const note =
      status === "rejected"
        ? (window.prompt(
            `Reason for rejecting ${row.student_name}'s leave (optional)`,
          ) ?? null)
        : "";
    if (note === null) return;
    setBusy(row.code);
    try {
      await apiRequest(
        `students/leave-workspace/${encodeURIComponent(row.code)}/decision`,
        { method: "POST", body: { status, note } },
      );
      toast.success(
        status === "approved" ? "Leave approved" : "Leave rejected",
        "The student and parents have been notified.",
      );
      setVersion((n) => n + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="stf-dir" aria-label="Student leave">
      <header className="stf-dir-heading">
        <div>
          <p>Student operations</p>
          <h1>Student leave</h1>
        </div>
        <button
          className="stf-refresh"
          type="button"
          onClick={() => setVersion((n) => n + 1)}
          aria-label="Refresh leave requests"
          title="Refresh"
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </header>
      {!data ? (
        <WorkspaceSkeleton label="Loading leave requests" />
      ) : (
        <div className="stf-card">
          <div className="stf-dir-bar">
            <SearchField
              aria-label="Search leave requests"
              placeholder="Search student, admission number or course"
              value={query}
              onValueChange={setQuery}
            />
            <p>
              {data.counts.pending || 0} pending · {data.counts.approved || 0}{" "}
              approved · {data.counts.rejected || 0} rejected
            </p>
            <div className="stf-directory-actions" role="tablist">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  className={filter === f ? "stf-directory-add" : ""}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
                  {f !== "all" ? ` (${data.counts[f] || 0})` : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="stf-table-wrap">
            <table className="stf-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course · Academic year</th>
                  <th>Dates</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {data.can_decide && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code}>
                    <td>
                      <strong>{r.student_name}</strong>
                      <br />
                      <code className="stf-code">
                        {r.admission_number || r.student_code}
                      </code>
                    </td>
                    <td>
                      {r.course_name || "—"}
                      <br />
                      <small>
                        {[
                          r.academic_year_name,
                          r.section_name && `Section ${r.section_name}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </td>
                    <td>
                      {date(r.start_date)} → {date(r.end_date)}
                      {r.days ? (
                        <>
                          <br />
                          <small>
                            {r.days} day{r.days === 1 ? "" : "s"}
                          </small>
                        </>
                      ) : null}
                    </td>
                    <td>{r.reason}</td>
                    <td>
                      <span
                        className={`stf-docs-badge ${r.status === "approved" ? "done" : ""}`}
                      >
                        {r.status[0].toUpperCase() + r.status.slice(1)}
                      </span>
                      {r.approved_by_name && (
                        <>
                          <br />
                          <small>by {r.approved_by_name}</small>
                        </>
                      )}
                      {r.decision_note && (
                        <>
                          <br />
                          <small>{r.decision_note}</small>
                        </>
                      )}
                    </td>
                    {data.can_decide && (
                      <td>
                        {r.status === "pending" ? (
                          <div className="stf-row-actions">
                            <button
                              type="button"
                              className="icon-action"
                              title={`Approve ${r.student_name}'s leave`}
                              aria-label={`Approve ${r.student_name}'s leave`}
                              disabled={busy === r.code}
                              onClick={() => void decide(r, "approved")}
                            >
                              <Check size={16} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="icon-action"
                              title={`Reject ${r.student_name}'s leave`}
                              aria-label={`Reject ${r.student_name}'s leave`}
                              disabled={busy === r.code}
                              onClick={() => void decide(r, "rejected")}
                            >
                              <X size={16} aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="stf-empty">
                {data.total
                  ? "No leave requests match this view."
                  : "No student leave requests yet. Requests made in the student / parent app appear here."}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
