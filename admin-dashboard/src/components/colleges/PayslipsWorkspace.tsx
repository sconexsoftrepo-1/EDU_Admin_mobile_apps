"use client";
/** Salary & payslips: each employee's salary structure and formatted monthly payslips (PDF). */
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Play, RefreshCw, Wallet } from "lucide-react";
import SideDrawer from "./SideDrawer";
import PDFActions from "./PDFActions";
import SearchField from "./SearchField";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import { toast, useErrorToast } from "./toast";
import { api, errorText } from "@/services/api";
import {
  payrollService,
  type Payslip,
  type PayrollRun,
  type SalaryEmployee,
  type TaxDocument,
  type SalaryLine,
  type SalaryStructure,
} from "@/services/api/modules/payroll/service";
import "./staff/staff.css";
import "./payslips.css";

const inr = (v?: string | number | null) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(v || 0));

function Statement({
  earnings,
  deductions,
  gross,
  less,
}: {
  earnings: SalaryLine[];
  deductions: SalaryLine[];
  gross: string;
  less: string;
}) {
  const rows = Math.max(earnings.length, deductions.length, 1);
  return (
    <table className="pay-statement">
      <thead>
        <tr>
          <th>Earnings</th>
          <th className="num">Amount</th>
          <th>Deductions</th>
          <th className="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, i) => (
          <tr key={i}>
            <td>{earnings[i]?.component || ""}</td>
            <td className="num">
              {earnings[i] ? inr(earnings[i].amount) : ""}
            </td>
            <td>{deductions[i]?.component || ""}</td>
            <td className="num">
              {deductions[i] ? inr(deductions[i].amount) : ""}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th>Gross earnings</th>
          <th className="num">{inr(gross)}</th>
          <th>Total deductions</th>
          <th className="num">{inr(less)}</th>
        </tr>
      </tfoot>
    </table>
  );
}

/** Financial year (April–March) containing `d`, e.g. "2026-2027". */
function financialYear(d: Date, back = 0) {
  const start =
    (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1) - back;
  return `${start}-${start + 1}`;
}

export default function PayslipsWorkspace() {
  const [people, setPeople] = useState<SalaryEmployee[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<{
    employee: SalaryEmployee;
    structure: SalaryStructure;
    payslips: Payslip[];
  } | null>(null);
  const [open, setOpen] = useState<Payslip | null>(null);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [canRun, setCanRun] = useState(false);
  const [canTax, setCanTax] = useState(false);
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [tax, setTax] = useState<{
    code: string;
    items: TaxDocument[];
  } | null>(null);
  const [fy, setFy] = useState(() => financialYear(new Date(), 1));
  const [query, setQuery] = useState("");
  const [staffKind, setStaffKind] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useErrorToast(error);

  useEffect(() => {
    let active = true;
    payrollService
      .employees()
      .then((r) => {
        if (!active) return;
        setPeople(r.items);
        setCanManage(r.can_manage);
        setRuns(r.runs || []);
        setCanRun(!!r.can_run);
        setCanTax(!!r.can_publish_tax);
        setSelected((current) => current || r.items[0]?.code || "");
      })
      .catch((e) => active && setError(errorText(e)));
    return () => {
      active = false;
    };
  }, [version]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    payrollService
      .employee(selected)
      .then((r) => active && setDetail(r))
      .catch((e) => active && setError(errorText(e)));
    return () => {
      active = false;
    };
  }, [selected, version]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    payrollService
      .taxDocuments(selected)
      .then((r) => active && setTax({ code: selected, items: r }))
      .catch(() => active && setTax({ code: selected, items: [] }));
    return () => {
      active = false;
    };
  }, [selected, version]);

  async function runPayroll() {
    setBusy(true);
    try {
      const r = await payrollService.run(month);
      const made = r.runs.reduce((n, x) => n + x.payslips, 0);
      const skipped = r.runs.flatMap((x) => x.skipped);
      toast.success(
        `${r.period}: ${made} payslip${made === 1 ? "" : "s"} published`,
        skipped.length
          ? `Skipped ${skipped.length} without a salary structure: ${skipped
              .slice(0, 5)
              .map((x) => x.name)
              .join(", ")}${skipped.length > 5 ? "…" : ""}`
          : "Staff can see them in the app now.",
      );
      setVersion((n) => n + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function generateForm16() {
    if (!selected) return;
    setBusy(true);
    try {
      await payrollService.generateForm16(selected, fy);
      toast.success(
        `Form 16 for ${fy} generated`,
        "It is in the employee's tax documents in the app.",
      );
      setVersion((n) => n + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const taxPdf = (doc: TaxDocument, mode: "view" | "download") =>
    api.documents.open(
      "tax-document",
      doc.code,
      doc.original_filename || `Form16-${doc.financial_year}.pdf`,
      mode,
    );

  async function markPaid(run: string) {
    setBusy(true);
    try {
      await payrollService.markPaid(run);
      toast.success(
        "Payroll marked paid",
        "Every payslip now has a salary payment receipt.",
      );
      setVersion((n) => n + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(
    () =>
      (people || []).filter(
        (p) =>
          (!staffKind || p.staff_kind === staffKind) &&
          `${p.name} ${p.code} ${p.designation || ""} ${p.department || ""}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [people, query, staffKind],
  );

  const fileName = (slip: Payslip, kind: string) =>
    `${kind}-${(detail?.employee.name || slip.code).replaceAll(" ", "-")}-${slip.period.replaceAll(" ", "-")}.pdf`;
  const slipPdf = (slip: Payslip, mode: "view" | "download") =>
    api.documents.open("payslip", slip.code, fileName(slip, "payslip"), mode);
  const receiptPdf = (slip: Payslip, mode: "view" | "download") =>
    api.documents.open(
      "salary-receipt",
      slip.code,
      fileName(slip, "salary-receipt"),
      mode,
    );

  const taxDocs = tax?.code === selected ? tax.items : null;
  const structure = detail?.structure;
  const loadingDetail = !!selected && detail?.employee.code !== selected;
  return (
    <section className="stf-dir" aria-label="Salary and payslips">
      <header className="stf-dir-heading">
        <div>
          <p>HR &amp; payroll</p>
          <h1>Salary &amp; payslips</h1>
        </div>
        <button
          className="stf-refresh"
          type="button"
          onClick={() => setVersion((n) => n + 1)}
          aria-label="Refresh salary details"
          title="Refresh"
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </header>
      {people && canRun && (
        <section className="stf-card pay-run" aria-label="Payroll run">
          <div className="pay-run-bar">
            <div>
              <h3>Monthly payroll</h3>
              <p className="pay-muted">
                Calculates every active employee&apos;s payslip from their
                salary structure and publishes it to the staff app.
              </p>
            </div>
            <label className="pay-field">
              <span>Month</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="stf-directory-add pay-run-button"
              disabled={busy || !month}
              onClick={() => void runPayroll()}
            >
              <Play size={14} aria-hidden="true" />
              Run &amp; publish payroll
            </button>
          </div>
          {runs.length > 0 && (
            <ul className="pay-runs">
              {runs.slice(0, 6).map((r) => (
                <li key={r.code}>
                  <strong>{r.period}</strong>
                  <small>{r.campus}</small>
                  <span
                    className={`stf-docs-badge ${["published", "paid"].includes(r.status) ? "done" : ""}`}
                  >
                    {r.status}
                  </span>
                  <small>
                    {r.payslips} payslip{r.payslips === 1 ? "" : "s"} ·{" "}
                    {inr(r.net_total)}
                  </small>
                  {r.status === "published" && (
                    <button
                      type="button"
                      className="pay-run-paid"
                      disabled={busy}
                      onClick={() => void markPaid(r.code)}
                    >
                      Mark paid
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {!people ? (
        <WorkspaceSkeleton label="Loading salary details" />
      ) : (
        <div className={canManage ? "pay-layout" : "pay-layout pay-single"}>
          {canManage && (
            <aside className="stf-card pay-people" aria-label="Employees">
              <div className="pay-people-search">
                <SearchField
                  aria-label="Search employees"
                  placeholder="Search employee"
                  value={query}
                  onValueChange={setQuery}
                />
                <div className="pay-kinds" role="tablist" aria-label="Staff">
                  {[
                    ["", "All"],
                    ["Teaching staff", "Teaching"],
                    ["Non-teaching staff", "Non-teaching"],
                  ].map(([k, label]) => (
                    <button
                      key={label}
                      type="button"
                      role="tab"
                      aria-selected={staffKind === k}
                      className={staffKind === k ? "on" : ""}
                      onClick={() => setStaffKind(k)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <ul>
                {visible.map((p) => (
                  <li key={p.code}>
                    <button
                      type="button"
                      aria-pressed={p.code === selected}
                      onClick={() => setSelected(p.code)}
                    >
                      <strong>{p.name}</strong>
                      <small>
                        {[p.designation, p.department, p.staff_kind]
                          .filter(Boolean)
                          .join(" · ") || p.code}
                      </small>
                      <span>
                        {inr(p.net_monthly)} / month · {p.payslips || 0} payslip
                        {p.payslips === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                ))}
                {!visible.length && (
                  <li className="stf-empty">No one matches.</li>
                )}
              </ul>
            </aside>
          )}
          <div className="pay-detail">
            {!selected ? (
              <p className="stf-empty">No employee records yet.</p>
            ) : loadingDetail || !detail || !structure ? (
              <WorkspaceSkeleton compact label="Loading salary" />
            ) : (
              <>
                <section className="stf-card pay-summary">
                  <div className="pay-person">
                    <span className="pay-avatar" aria-hidden="true">
                      <Wallet size={20} />
                    </span>
                    <div>
                      <h2>{detail.employee.name}</h2>
                      <p>
                        {[
                          detail.employee.code,
                          detail.employee.designation,
                          detail.employee.department,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <dl className="pay-figures">
                    <div>
                      <dt>Gross / month</dt>
                      <dd>{inr(structure.gross_monthly)}</dd>
                    </div>
                    <div>
                      <dt>Deductions / month</dt>
                      <dd>{inr(structure.deductions_monthly)}</dd>
                    </div>
                    <div className="pay-net">
                      <dt>Take-home / month</dt>
                      <dd>
                        {inr(
                          structure.in_hand_monthly || structure.net_monthly,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Annual CTC</dt>
                      <dd>{inr(structure.ctc_annual)}</dd>
                    </div>
                  </dl>
                </section>
                <section className="stf-card pay-section">
                  <div className="pay-tax-head">
                    <h3>Salary structure</h3>
                    <PDFActions
                      viewLabel="View salary structure"
                      onAction={(mode) =>
                        api.documents.open(
                          "salary-structure",
                          detail.employee.code,
                          `salary-structure-${detail.employee.name.replaceAll(" ", "-")}.pdf`,
                          mode,
                        )
                      }
                    >
                      <Download size={13} aria-hidden="true" /> Download PDF
                    </PDFActions>
                  </div>
                  <p className="pay-muted">
                    Monthly
                    {structure.effective_from
                      ? ` · effective ${structure.effective_from.slice(0, 10)}`
                      : ""}
                  </p>
                  <Statement
                    earnings={structure.earnings}
                    deductions={structure.deductions}
                    gross={structure.gross_monthly}
                    less={structure.deductions_monthly}
                  />
                </section>
                <section className="stf-card pay-section">
                  <h3>Monthly payslips</h3>
                  {!detail.payslips.length ? (
                    <p className="stf-empty">
                      No payslips yet. Use Monthly payroll above to run and
                      publish a month.
                    </p>
                  ) : (
                    <div className="pay-slips">
                      {detail.payslips.map((slip) => (
                        <article key={slip.code} className="pay-slip">
                          <header>
                            <strong>{slip.period}</strong>
                            {slip.run_status && (
                              <span
                                className={`stf-docs-badge ${["published", "paid"].includes(slip.run_status) ? "done" : ""}`}
                              >
                                {slip.run_status}
                              </span>
                            )}
                          </header>
                          <p className="pay-slip-net">{inr(slip.net_amount)}</p>
                          <p className="pay-muted">
                            Gross {inr(slip.gross_amount)} · Deductions{" "}
                            {inr(slip.deduction_amount)}
                          </p>
                          {slip.paid_on && (
                            <p className="pay-slip-paid">
                              Paid {slip.paid_on.slice(0, 10)} ·{" "}
                              {slip.receipt_number}
                            </p>
                          )}
                          <div className="stf-directory-actions">
                            <button type="button" onClick={() => setOpen(slip)}>
                              <FileText size={14} aria-hidden="true" />
                              Details
                            </button>
                          </div>
                          <PDFActions
                            viewLabel="View payslip"
                            onAction={(mode) => slipPdf(slip, mode)}
                          >
                            <Download size={13} aria-hidden="true" /> PDF
                          </PDFActions>
                          {slip.paid_on && (
                            <PDFActions
                              viewLabel="View receipt"
                              onAction={(mode) => receiptPdf(slip, mode)}
                            >
                              <Download size={13} aria-hidden="true" /> PDF
                            </PDFActions>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                <section className="stf-card pay-section">
                  <div className="pay-tax-head">
                    <div>
                      <h3>Form 16 &amp; tax documents</h3>
                      <p className="pay-muted">
                        Form 16 Part B is prepared from the payslips published
                        in the financial year.
                      </p>
                    </div>
                    {canTax && (
                      <div className="pay-tax-actions">
                        <label className="pay-field">
                          <span>Financial year</span>
                          <select
                            value={fy}
                            onChange={(e) => setFy(e.target.value)}
                          >
                            {[0, 1, 2, 3].map((back) => {
                              const value = financialYear(new Date(), back);
                              return (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="stf-directory-add"
                          disabled={busy}
                          onClick={() => void generateForm16()}
                        >
                          <FileText size={14} aria-hidden="true" />
                          Generate Form 16
                        </button>
                      </div>
                    )}
                  </div>
                  {taxDocs === null ? (
                    <WorkspaceSkeleton compact label="Loading tax documents" />
                  ) : !taxDocs.length ? (
                    <p className="stf-empty">No Form 16 issued yet.</p>
                  ) : (
                    <ul className="pay-tax-list">
                      {taxDocs.map((doc) => (
                        <li key={doc.code}>
                          <div>
                            <strong>
                              {doc.document_type === "form_16a"
                                ? "Form 16A"
                                : doc.document_type === "form_16"
                                  ? "Form 16"
                                  : "Tax document"}{" "}
                              · FY {doc.financial_year}
                            </strong>
                            <small>
                              Revision {doc.revision}
                              {doc.published_at
                                ? ` · ${doc.published_at.slice(0, 10)}`
                                : ""}
                              {doc.generated ? " · generated" : " · uploaded"}
                            </small>
                          </div>
                          <PDFActions
                            viewLabel="View Form 16"
                            onAction={(mode) => taxPdf(doc, mode)}
                          >
                            <Download size={13} aria-hidden="true" /> PDF
                          </PDFActions>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}
      {open && detail && (
        <SideDrawer
          title={`Payslip · ${open.period}`}
          subtitle={`${detail.employee.name} · ${detail.employee.code}`}
          onClose={() => setOpen(null)}
          actions={
            <PDFActions onAction={(mode) => slipPdf(open, mode)}>
              Payslip
            </PDFActions>
          }
        >
          <div className="pay-sheet">
            <dl className="pay-meta">
              <div>
                <dt>Designation</dt>
                <dd>{detail.employee.designation || "—"}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{detail.employee.department || "—"}</dd>
              </div>
              <div>
                <dt>PAN</dt>
                <dd>{detail.employee.pan || "—"}</dd>
              </div>
              <div>
                <dt>Bank account</dt>
                <dd>{detail.employee.bank || "—"}</dd>
              </div>
              {open.paid_on && (
                <>
                  <div>
                    <dt>Paid on</dt>
                    <dd>{open.paid_on.slice(0, 10)}</dd>
                  </div>
                  <div>
                    <dt>Payment reference</dt>
                    <dd>{open.transaction_reference || "—"}</dd>
                  </div>
                </>
              )}
            </dl>
            <Statement
              earnings={open.earnings}
              deductions={open.deductions}
              gross={open.gross_amount}
              less={open.deduction_amount}
            />
            <div className="pay-net-box">
              <span>Net pay</span>
              <strong>{inr(open.net_amount)}</strong>
              <small>{open.net_in_words}</small>
            </div>
          </div>
        </SideDrawer>
      )}
    </section>
  );
}
