"use client";
import SearchField, { searchValues } from "../SearchField";
import PersonFiles from "../PersonFiles";
import { useErrorToast } from "../toast";
/** Staff table of one kind (teaching, non-teaching or daily labour) with search. */
import { useEffect, useState } from "react";
import {
  Download,
  FileText,
  FolderOpen,
  Info,
  Plus,
  RefreshCw,
} from "lucide-react";
import IconAction from "../IconAction";
import StaffDetails from "./StaffDetails";
import StaffOnboardingForm from "./StaffOnboardingForm";
import {
  STAFF_KIND_LABEL,
  api,
  errorText,
  type StaffKind,
  type StaffRow,
} from "@/services/api";
import { excelTable, pdfTable } from "@/lib/colleges/export-table";
import { formatDate } from "../DateInput";
import "./staff.css";

const inr = (v?: string | null) =>
  v
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(Number(v))
    : "—";
const date = (v?: string | null) => (v ? formatDate(v.slice(0, 10)) : "—");

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
  title,
  onRefresh,
  onAdd,
  canEdit = false,
}: {
  kind: StaffKind;
  reloadKey: number;
  title: string;
  onRefresh: () => void;
  onAdd: () => void;
  canEdit?: boolean;
}) {
  const [details, setDetails] = useState<StaffRow | null>(null);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [revision, setRevision] = useState(0);
  const [fileOwner, setFileOwner] = useState<string | null>(null);
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [error, setError] = useState("");
  useErrorToast(error);
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
  }, [kind, reloadKey, revision]);
  const visible = (rows || []).filter((r) =>
    `${r.employee_id} ${r.name} ${r.designation} ${r.department || ""} ${r.phone || ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const columns = COLUMNS[kind];
  const exportColumns = [
    "Employee ID",
    "Name",
    kind === "labour" ? "Role" : "Designation",
    ...columns.map((column) => column.label),
    ...(kind === "labour" ? [] : ["Documents"]),
  ];
  const exportRows = visible.map((row) => [
    row.employee_id,
    row.name,
    row.designation,
    ...columns.map((column) => String(column.cell(row))),
    ...(kind === "labour"
      ? []
      : [`${row.documents_uploaded} of ${row.documents_expected}`]),
  ]);
  const exportName = `${kind.replaceAll("_", "-")}-staff`;
  const exportExcel = () =>
    excelTable(exportName, "Staff", exportColumns, exportRows);
  const exportPdf = async () => {
    try {
      await pdfTable(
        exportName,
        `${STAFF_KIND_LABEL[kind]} directory`,
        `${visible.length} ${STAFF_KIND_LABEL[kind]}`,
        exportColumns,
        exportRows,
      );
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <section className="stf-dir" aria-label={STAFF_KIND_LABEL[kind]}>
      <header className="stf-dir-heading">
        <div>
          <p>College administration</p>
          <h1>{title}</h1>
        </div>
        <button
          className="stf-refresh"
          type="button"
          onClick={onRefresh}
          aria-label="Refresh staff"
          title="Refresh"
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="stf-card">
        <div className="stf-dir-bar">
          <SearchField
            aria-label="Search staff"
            placeholder="Search by name, ID, role or phone"
            value={query}
            onValueChange={setQuery}
            suggestions={searchValues(rows || [], ["name", "employee_id", "designation", "department", "phone"])}
          />
          <p>
            {rows ? `${rows.length} ${STAFF_KIND_LABEL[kind]}` : "Loading…"}
          </p>
          <div className="stf-directory-actions">
            <button type="button" className="stf-directory-add" onClick={onAdd}>
              <Plus size={14} aria-hidden="true" />
              Add {STAFF_KIND_LABEL[kind]}
            </button>
            <button type="button" onClick={exportExcel}>
              <Download size={14} aria-hidden="true" />
              Excel
            </button>
            <button type="button" onClick={() => void exportPdf()}>
              <FileText size={14} aria-hidden="true" />
              PDF
            </button>
          </div>
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
                <th>Actions</th>
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
                  <td>
                    <div className="stf-row-actions">
                      <button
                        type="button"
                        className="icon-action"
                        title={`View details for ${r.name}`}
                        aria-label={`View details for ${r.name}`}
                        onClick={() => setDetails(r)}
                      >
                        <Info size={16} aria-hidden="true" />
                      </button>
                      {canEdit && (
                        <IconAction
                          kind="edit"
                          label={`Edit ${r.name}`}
                          onClick={() => setEditing(r)}
                        />
                      )}
                      <button
                        type="button"
                        className="icon-action"
                        title={`Files for ${r.name}`}
                        aria-label={`Files for ${r.name}`}
                        onClick={() => setFileOwner(r.employee_id)}
                      >
                        <FolderOpen size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
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
      </div>
      {details && (
        <StaffDetails
          key={details.employee_id}
          staff={details}
          kind={kind}
          onClose={() => setDetails(null)}
          onEdit={
            canEdit
              ? () => {
                  setDetails(null);
                  setEditing(details);
                }
              : undefined
          }
        />
      )}
      {editing && (
        <StaffOnboardingForm
          key={editing.employee_id}
          kind={kind}
          employeeId={editing.employee_id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setRevision((n) => n + 1);
            setEditing(null);
          }}
        />
      )}
      {fileOwner && (
        <PersonFiles
          personKind="employee"
          personCode={fileOwner}
          onClose={() => setFileOwner(null)}
        />
      )}
    </section>
  );
}
