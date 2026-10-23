"use client";
/** Staff table of one kind (teaching, non-teaching or daily labour) with search. */
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  STAFF_KIND_LABEL,
  api,
  errorText,
  type StaffKind,
  type StaffRow,
} from "@/services/api";
import "./staff.css";

const inr = (v?: string | null) =>
  v
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(Number(v))
    : "—";
const date = (v?: string | null) =>
  v
    ? new Date(v).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

type Column = {
  label: string;
  cell: (r: StaffRow) => React.ReactNode;
  numeric?: boolean;
};

const COLUMNS: Record<StaffKind, Column[]> = {
  teaching: [
    {
      label: "Qualification",
      cell: (r) =>
        [r.qualification, r.specialization].filter(Boolean).join(", ") || "—",
    },
    { label: "Department", cell: (r) => r.department || "—" },
    { label: "Phone", cell: (r) => r.phone || "—" },
    { label: "Joined", cell: (r) => date(r.join_date) },
    {
      label: "Net pay / month",
      cell: (r) => inr(r.net_monthly),
      numeric: true,
    },
  ],
  non_teaching: [
    { label: "Department", cell: (r) => r.department || "—" },
    { label: "Phone", cell: (r) => r.phone || "—" },
    { label: "Email", cell: (r) => r.email || "—" },
    { label: "Joined", cell: (r) => date(r.join_date) },
    {
      label: "Net pay / month",
      cell: (r) => inr(r.net_monthly),
      numeric: true,
    },
  ],
  labour: [
    {
      label: "Wage",
      cell: (r) =>
        `${inr(r.salary_amount)} ${r.salary_basis === "daily" ? "a day" : r.salary_basis === "yearly" ? "a year" : "a month"}`,
      numeric: true,
    },
    { label: "Bank account", cell: (r) => r.bank || "—" },
    { label: "Aadhaar", cell: (r) => r.aadhaar || "—" },
    { label: "Joined", cell: (r) => date(r.join_date) },
  ],
};

export default function StaffDirectory({
  kind,
  reloadKey,
}: {
  kind: StaffKind;
  reloadKey: number;
}) {
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    let active = true;
    void api.staff
      .list(kind)
      .then((r) => active && setRows(r.items))
      .catch((e) => active && setError(errorText(e)));
    return () => {
      active = false;
    };
  }, [kind, reloadKey]);
  const visible = (rows || []).filter((r) =>
    `${r.employee_id} ${r.name} ${r.designation} ${r.department || ""} ${r.phone || ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const columns = COLUMNS[kind];
  return (
    <section className="stf-dir" aria-label={STAFF_KIND_LABEL[kind]}>
      <div className="stf-dir-bar">
        <p>{rows ? `${rows.length} ${STAFF_KIND_LABEL[kind]}` : "Loading…"}</p>
        <label className="stf-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search staff"
            placeholder="Search by name, ID, role or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p className="edu-error" role="alert">
          {error}
        </p>
      )}
      <div className="stf-table-wrap">
        <table className="stf-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>{kind === "labour" ? "Role" : "Designation"}</th>
              {columns.map((c) => (
                <th key={c.label} className={c.numeric ? "num" : ""}>
                  {c.label}
                </th>
              ))}
              {kind !== "labour" && <th>Documents</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.employee_id}>
                <td>
                  <code className="stf-code">{r.employee_id}</code>
                </td>
                <td>
                  <strong>{r.name}</strong>
                </td>
                <td>{r.designation}</td>
                {columns.map((c) => (
                  <td key={c.label} className={c.numeric ? "num" : ""}>
                    {c.cell(r)}
                  </td>
                ))}
                {kind !== "labour" && (
                  <td>
                    <span
                      className={
                        r.documents_uploaded >= r.documents_expected &&
                        r.documents_expected
                          ? "stf-docs-badge done"
                          : "stf-docs-badge"
                      }
                    >
                      {r.documents_uploaded} of {r.documents_expected}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {rows && visible.length === 0 && (
          <p className="stf-empty">
            {rows.length
              ? "No one matches the search."
              : `No ${STAFF_KIND_LABEL[kind]} yet. Use the Add button to onboard the first one.`}
          </p>
        )}
      </div>
    </section>
  );
}
